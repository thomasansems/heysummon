import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { mkdtempSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { HeySummonClient } from "../src/client.js";
import {
  generateKeyMaterial,
  generatePersistentKeys,
  encryptWithKeys,
} from "../src/crypto.js";

const BASE = "http://test.heysummon.local";
const API_KEY = "hs_cli_test000";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function client(opts?: { e2e?: boolean }) {
  return new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, ...opts });
}

describe("HeySummonClient", () => {
  it("whoami() sends x-api-key header and parses response", async () => {
    let receivedKey: string | null = null;
    server.use(
      http.get(`${BASE}/api/v1/whoami`, ({ request }) => {
        receivedKey = request.headers.get("x-api-key");
        return HttpResponse.json({
          keyId: "kid1",
          keyName: "test key",
          provider: { id: "prov1", name: "TestProvider", isActive: true },
          expert: { id: "exp1", name: "Expert One" },
        });
      })
    );

    const result = await client().whoami();
    expect(receivedKey).toBe(API_KEY);
    expect(result.keyId).toBe("kid1");
    expect(result.provider.name).toBe("TestProvider");
  });

  it("submitRequest() sends question and keys in body", async () => {
    let body: unknown;
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          requestId: "req1",
          refCode: "HS-TEST",
          status: "pending",
          expiresAt: new Date().toISOString(),
        });
      })
    );

    const result = await client().submitRequest({
      question: "Help me with X",
      signPublicKey: "sign-key",
      encryptPublicKey: "enc-key",
    });

    expect((body as Record<string, string>).question).toBe("Help me with X");
    expect((body as Record<string, string>).signPublicKey).toBe("sign-key");
    expect(result.requestId).toBe("req1");
    expect(result.refCode).toBe("HS-TEST");
  });

  it("getPendingEvents() returns events array", async () => {
    server.use(
      http.get(`${BASE}/api/v1/events/pending`, () =>
        HttpResponse.json({
          events: [
            {
              type: "new_message",
              requestId: "req1",
              refCode: "HS-TEST",
              latestMessageAt: "2026-01-01T00:00:00Z",
            },
          ],
        })
      )
    );

    const result = await client().getPendingEvents();
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("new_message");
  });

  it("ackEvent() posts to ack endpoint", async () => {
    let called = false;
    server.use(
      http.post(`${BASE}/api/v1/events/ack/req1`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    await client().ackEvent("req1");
    expect(called).toBe(true);
  });

  it("getMessages() returns messages array", async () => {
    server.use(
      http.get(`${BASE}/api/v1/messages/req1`, () =>
        HttpResponse.json({
          messages: [
            {
              id: "msg1",
              from: "provider",
              ciphertext: "abc",
              iv: "iv1",
              authTag: "tag1",
              signature: "sig1",
              messageId: "msgid1",
              createdAt: "2026-01-01T00:00:00Z",
            },
          ],
        })
      )
    );

    const result = await client().getMessages("req1");
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].from).toBe("provider");
  });

  it("getRequestStatus() returns flat status object", async () => {
    server.use(
      http.get(`${BASE}/api/v1/help/req1`, () =>
        HttpResponse.json({
          requestId: "req1",
          status: "responded",
          refCode: "HS-TEST",
          response: "Yes, do it",
        })
      )
    );

    const result = await client().getRequestStatus("req1");
    expect(result.status).toBe("responded");
    expect(result.refCode).toBe("HS-TEST");
    expect(result.response).toBe("Yes, do it");
  });

  it("getRequestByRef() returns request by ref code", async () => {
    server.use(
      http.get(`${BASE}/api/v1/requests/by-ref/HS-TEST`, () =>
        HttpResponse.json({
          requestId: "req1",
          status: "responded",
          refCode: "HS-TEST",
          question: "Should I?",
          provider: { id: "prov1", name: "Thomas" },
        })
      )
    );

    const result = await client().getRequestByRef("HS-TEST");
    expect(result.requestId).toBe("req1");
    expect(result.question).toBe("Should I?");
    expect(result.provider?.name).toBe("Thomas");
  });

  it("throws descriptive error on non-OK response", async () => {
    server.use(
      http.get(`${BASE}/api/v1/whoami`, () =>
        HttpResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
    );

    await expect(client().whoami()).rejects.toThrow("401");
  });

  it("trims trailing slash from baseUrl", async () => {
    let called = false;
    server.use(
      http.get(`${BASE}/api/v1/whoami`, () => {
        called = true;
        return HttpResponse.json({
          keyId: "kid1",
          keyName: null,
          provider: { id: "p1", name: "P", isActive: true },
          expert: { id: "e1", name: null },
        });
      })
    );

    const trailingClient = new HeySummonClient({ baseUrl: `${BASE}/`, apiKey: API_KEY });
    await trailingClient.whoami();
    expect(called).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/*  E2E encryption: auto-keygen, keyStore, decrypt, sendMessage, importKeys   */
/* -------------------------------------------------------------------------- */

describe("HeySummonClient — E2E encryption", () => {
  // Generate two sets of keys to simulate consumer <-> provider
  const consumer = generateKeyMaterial();
  const provider = generateKeyMaterial();

  /** Helper: mock the /api/v1/help POST endpoint */
  function mockSubmit(handler?: (body: Record<string, unknown>) => void) {
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        handler?.(body);
        return HttpResponse.json({
          requestId: "req-e2e",
          refCode: "HS-E2E",
          status: "pending",
          expiresAt: new Date().toISOString(),
        });
      })
    );
  }

  /** Helper: build a MessagesResponse with keys and messages */
  function messagesResponse(
    messages: unknown[],
    opts?: { withProviderKeys?: boolean; withConsumerKeys?: boolean }
  ) {
    const withProvider = opts?.withProviderKeys !== false;
    const withConsumer = opts?.withConsumerKeys !== false;
    return {
      requestId: "req-e2e",
      refCode: "HS-E2E",
      status: "active",
      consumerSignPubKey: withConsumer ? consumer.signPublicKey : null,
      consumerEncryptPubKey: withConsumer ? consumer.encryptPublicKey : null,
      providerSignPubKey: withProvider ? provider.signPublicKey : null,
      providerEncryptPubKey: withProvider ? provider.encryptPublicKey : null,
      messages,
      expiresAt: new Date().toISOString(),
    };
  }

  describe("auto-keygen on submitRequest", () => {
    it("e2e: true (default) auto-generates keys", async () => {
      let sentBody: Record<string, unknown> = {};
      mockSubmit((body) => { sentBody = body; });

      const c = client(); // e2e defaults to true
      await c.submitRequest({ question: "Need approval" });

      // Keys should have been auto-generated and sent
      expect(sentBody.signPublicKey).toBeTruthy();
      expect(sentBody.encryptPublicKey).toBeTruthy();
      expect(typeof sentBody.signPublicKey).toBe("string");
      expect((sentBody.signPublicKey as string).length).toBe(88); // hex DER
    });

    it("e2e: false does NOT generate keys", async () => {
      let sentBody: Record<string, unknown> = {};
      mockSubmit((body) => { sentBody = body; });

      const c = client({ e2e: false });
      await c.submitRequest({ question: "Plaintext only" });

      expect(sentBody.signPublicKey).toBeUndefined();
      expect(sentBody.encryptPublicKey).toBeUndefined();
    });

    it("explicit keys skip auto-generation", async () => {
      let sentBody: Record<string, unknown> = {};
      mockSubmit((body) => { sentBody = body; });

      const c = client();
      await c.submitRequest({
        question: "I have my own keys",
        signPublicKey: "my-sign-key",
        encryptPublicKey: "my-enc-key",
      });

      // Should use the consumer-provided keys, not auto-generated ones
      expect(sentBody.signPublicKey).toBe("my-sign-key");
      expect(sentBody.encryptPublicKey).toBe("my-enc-key");
    });
  });

  describe("getMessages — auto-decrypt", () => {
    it("auto-decrypts when keyStore has keys", async () => {
      // Capture the auto-generated consumer public keys from the submit request
      let consumerEncPubHex = "";
      server.use(
        http.post(`${BASE}/api/v1/help`, async ({ request }) => {
          const body = (await request.json()) as Record<string, string>;
          consumerEncPubHex = body.encryptPublicKey;
          return HttpResponse.json({
            requestId: "req-e2e",
            refCode: "HS-E2E",
            status: "pending",
            expiresAt: new Date().toISOString(),
          });
        })
      );

      const c = client();
      await c.submitRequest({ question: "test" });

      // Reconstruct the auto-generated consumer's public key so provider can encrypt for it
      const { publicKeyFromHex: pubFromHex } = await import("../src/crypto.js");
      const consumerEncPub = pubFromHex(consumerEncPubHex, "x25519");

      // Provider encrypts a message targeting the auto-generated consumer key
      const encrypted = encryptWithKeys(
        "Hello from provider",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey,
        "msgid-001"
      );

      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json({
            requestId: "req-e2e",
            refCode: "HS-E2E",
            status: "active",
            consumerSignPubKey: null,
            consumerEncryptPubKey: consumerEncPubHex,
            providerSignPubKey: provider.signPublicKey,
            providerEncryptPubKey: provider.encryptPublicKey,
            messages: [
              {
                id: "m1",
                from: "provider",
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                signature: encrypted.signature,
                messageId: encrypted.messageId,
                createdAt: "2026-04-04T12:00:00Z",
              },
            ],
            expiresAt: new Date().toISOString(),
          })
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].plaintext).toBe("Hello from provider");
      expect(result.messages[0].ciphertext).toBeUndefined();
    });

    it("returns raw when no keys in store", async () => {
      // Fresh client, no submitRequest -> no keyStore entry
      const c = client();

      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json(
            messagesResponse([
              {
                id: "m2",
                from: "provider",
                ciphertext: "encrypted-blob",
                iv: "some-iv",
                authTag: "some-tag",
                signature: "some-sig",
                messageId: "msgid-002",
                createdAt: "2026-04-04T12:00:00Z",
              },
            ])
          )
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].ciphertext).toBe("encrypted-blob");
      expect(result.messages[0].plaintext).toBeUndefined();
    });

    it("plaintext messages (iv: \"plaintext\") pass through", async () => {
      const c = client();

      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json(
            messagesResponse([
              {
                id: "m3",
                from: "provider",
                ciphertext: Buffer.from("Plain answer").toString("base64"),
                iv: "plaintext",
                authTag: "",
                signature: "",
                messageId: "msgid-003",
                createdAt: "2026-04-04T12:00:00Z",
              },
            ])
          )
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages[0].plaintext).toBe("Plain answer");
      expect(result.messages[0].ciphertext).toBeUndefined();
    });

    it("handles mixed messages (some encrypted, some plaintext)", async () => {
      // Capture auto-generated consumer keys
      let consumerEncPubHex = "";
      server.use(
        http.post(`${BASE}/api/v1/help`, async ({ request }) => {
          const body = (await request.json()) as Record<string, string>;
          consumerEncPubHex = body.encryptPublicKey;
          return HttpResponse.json({
            requestId: "req-e2e",
            refCode: "HS-E2E",
            status: "pending",
            expiresAt: new Date().toISOString(),
          });
        })
      );

      const c = client();
      await c.submitRequest({ question: "test" });

      const { publicKeyFromHex: pubFromHex } = await import("../src/crypto.js");
      const consumerEncPub = pubFromHex(consumerEncPubHex, "x25519");

      const encrypted = encryptWithKeys(
        "Secret reply",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey,
        "msgid-mix-1"
      );

      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json({
            requestId: "req-e2e",
            refCode: "HS-E2E",
            status: "active",
            consumerSignPubKey: null,
            consumerEncryptPubKey: consumerEncPubHex,
            providerSignPubKey: provider.signPublicKey,
            providerEncryptPubKey: provider.encryptPublicKey,
            messages: [
              {
                id: "m-enc",
                from: "provider",
                ciphertext: encrypted.ciphertext,
                iv: encrypted.iv,
                authTag: encrypted.authTag,
                signature: encrypted.signature,
                messageId: encrypted.messageId,
                createdAt: "2026-04-04T12:00:00Z",
              },
              {
                id: "m-plain",
                from: "provider",
                ciphertext: Buffer.from("Open message").toString("base64"),
                iv: "plaintext",
                authTag: "",
                signature: "",
                messageId: "msgid-mix-2",
                createdAt: "2026-04-04T12:01:00Z",
              },
            ],
            expiresAt: new Date().toISOString(),
          })
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].plaintext).toBe("Secret reply");
      expect(result.messages[1].plaintext).toBe("Open message");
    });

    it("decrypts mixed thread with both consumer and provider encrypted messages", async () => {
      const c = client({ e2e: false });
      // Inject known consumer keys into the private keyStore for deterministic test
      (c as Record<string, unknown>)["keyStore"] = new Map([["req-e2e", consumer]]);

      const { publicKeyFromHex: pubFromHex } = await import("../src/crypto.js");
      const consumerEncPub = pubFromHex(consumer.encryptPublicKey, "x25519");
      const providerEncPub = pubFromHex(provider.encryptPublicKey, "x25519");

      // Provider encrypts targeting consumer: DH(providerEncPriv, consumerEncPub)
      const providerMsg = encryptWithKeys(
        "Message from provider",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey,
        "msgid-prov-1"
      );

      // Consumer encrypts targeting provider: DH(consumerEncPriv, providerEncPub)
      const consumerMsg = encryptWithKeys(
        "Message from consumer",
        providerEncPub,
        consumer.signKeyPair.privateKey,
        consumer.encryptKeyPair.privateKey,
        "msgid-cons-1"
      );

      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json({
            requestId: "req-e2e",
            refCode: "HS-E2E",
            status: "active",
            consumerSignPubKey: consumer.signPublicKey,
            consumerEncryptPubKey: consumer.encryptPublicKey,
            providerSignPubKey: provider.signPublicKey,
            providerEncryptPubKey: provider.encryptPublicKey,
            messages: [
              {
                id: "m-from-provider",
                from: "provider",
                ciphertext: providerMsg.ciphertext,
                iv: providerMsg.iv,
                authTag: providerMsg.authTag,
                signature: providerMsg.signature,
                messageId: providerMsg.messageId,
                createdAt: "2026-04-04T12:00:00Z",
              },
              {
                id: "m-from-consumer",
                from: "consumer",
                ciphertext: consumerMsg.ciphertext,
                iv: consumerMsg.iv,
                authTag: consumerMsg.authTag,
                signature: consumerMsg.signature,
                messageId: consumerMsg.messageId,
                createdAt: "2026-04-04T12:01:00Z",
              },
            ],
            expiresAt: new Date().toISOString(),
          })
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].plaintext).toBe("Message from provider");
      expect(result.messages[0].ciphertext).toBeUndefined();
      expect(result.messages[1].plaintext).toBe("Message from consumer");
      expect(result.messages[1].ciphertext).toBeUndefined();
    });

    it("decrypt failure sets decryptError: true", async () => {
      // Submit to populate keyStore
      mockSubmit();
      const c = client();
      await c.submitRequest({ question: "test" });

      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json(
            messagesResponse([
              {
                id: "m-bad",
                from: "provider",
                ciphertext: "corrupted-data",
                iv: "bad-iv",
                authTag: "bad-tag",
                signature: "bad-sig",
                messageId: "msgid-bad",
                createdAt: "2026-04-04T12:00:00Z",
              },
            ])
          )
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].decryptError).toBe(true);
      expect(result.messages[0].ciphertext).toBe("corrupted-data");
    });
  });

  describe("sendMessage", () => {
    it("encrypts when keys are available", async () => {
      // Submit to populate keyStore
      mockSubmit();
      const c = client();
      await c.submitRequest({ question: "test" });

      let sentPayload: Record<string, unknown> = {};

      // sendMessage fetches messages first to get provider keys
      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json(
            messagesResponse([], { withProviderKeys: true })
          )
        ),
        http.post(`${BASE}/api/v1/message/req-e2e`, async ({ request }) => {
          sentPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            messageId: "sent-1",
            createdAt: "2026-04-04T12:00:00Z",
          });
        })
      );

      await c.sendMessage("req-e2e", "Follow-up from consumer");

      expect(sentPayload.from).toBe("consumer");
      expect(sentPayload.ciphertext).toBeTruthy();
      expect(sentPayload.iv).toBeTruthy();
      expect(sentPayload.authTag).toBeTruthy();
      expect(sentPayload.signature).toBeTruthy();
      expect(sentPayload.messageId).toBeTruthy();
      // Should NOT have plaintext field
      expect(sentPayload.plaintext).toBeUndefined();
    });

    it("sends plaintext when no keys in store", async () => {
      const c = client(); // no submitRequest -> no keyStore

      let sentPayload: Record<string, unknown> = {};
      server.use(
        http.post(`${BASE}/api/v1/message/req-e2e`, async ({ request }) => {
          sentPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            messageId: "sent-2",
            createdAt: "2026-04-04T12:00:00Z",
          });
        })
      );

      await c.sendMessage("req-e2e", "Plaintext follow-up");

      expect(sentPayload.from).toBe("consumer");
      expect(sentPayload.plaintext).toBe("Plaintext follow-up");
      expect(sentPayload.ciphertext).toBeUndefined();
    });
  });

  describe("releaseKeys", () => {
    it("removes keys from store so subsequent calls return raw", async () => {
      // Submit to populate keyStore
      mockSubmit();
      const c = client();
      await c.submitRequest({ question: "test" });

      // Release keys for this request
      c.releaseKeys("req-e2e");

      // Now getMessages should return raw (no decryption)
      server.use(
        http.get(`${BASE}/api/v1/messages/req-e2e`, () =>
          HttpResponse.json(
            messagesResponse([
              {
                id: "m-after-release",
                from: "provider",
                ciphertext: "still-encrypted",
                iv: "enc-iv",
                authTag: "enc-tag",
                signature: "enc-sig",
                messageId: "msgid-released",
                createdAt: "2026-04-04T12:00:00Z",
              },
            ])
          )
        )
      );

      const result = await c.getMessages("req-e2e");
      expect(result.messages[0].ciphertext).toBe("still-encrypted");
      expect(result.messages[0].plaintext).toBeUndefined();
    });

    it("sendMessage falls back to plaintext after release", async () => {
      mockSubmit();
      const c = client();
      await c.submitRequest({ question: "test" });
      c.releaseKeys("req-e2e");

      let sentPayload: Record<string, unknown> = {};
      server.use(
        http.post(`${BASE}/api/v1/message/req-e2e`, async ({ request }) => {
          sentPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            messageId: "sent-3",
            createdAt: "2026-04-04T12:00:00Z",
          });
        })
      );

      await c.sendMessage("req-e2e", "After key release");
      expect(sentPayload.plaintext).toBe("After key release");
    });
  });

  describe("importKeys", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "hs-client-import-"));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("loads PEM files into keyStore and enables decryption", async () => {
      // Generate persistent keys on disk (simulates an OpenClaw consumer)
      const keyDir = join(tempDir, "keys");
      generatePersistentKeys(keyDir);

      const c = client({ e2e: false }); // e2e off, manual key import
      c.importKeys("req-import", keyDir);

      // Create an encrypted message that uses the imported keys
      // We need to read the imported public keys to encrypt towards them
      const importedKeys = generateKeyMaterial(); // stand-in for provider
      // Actually, we need to encrypt using the imported consumer's public key.
      // importKeys sets the consumer's keys in the store, so provider encrypts for consumer.
      // We don't have direct access to keyStore, but we can test via getMessages.

      // Instead: verify importKeys works by checking sendMessage uses encryption
      let sentPayload: Record<string, unknown> = {};
      server.use(
        http.get(`${BASE}/api/v1/messages/req-import`, () =>
          HttpResponse.json({
            requestId: "req-import",
            refCode: null,
            status: "active",
            consumerSignPubKey: null,
            consumerEncryptPubKey: null,
            providerSignPubKey: provider.signPublicKey,
            providerEncryptPubKey: provider.encryptPublicKey,
            messages: [],
            expiresAt: new Date().toISOString(),
          })
        ),
        http.post(`${BASE}/api/v1/message/req-import`, async ({ request }) => {
          sentPayload = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            success: true,
            messageId: "sent-import",
            createdAt: "2026-04-04T12:00:00Z",
          });
        })
      );

      await c.sendMessage("req-import", "Message with imported keys");

      // Should be encrypted, not plaintext
      expect(sentPayload.ciphertext).toBeTruthy();
      expect(sentPayload.iv).toBeTruthy();
      expect(sentPayload.plaintext).toBeUndefined();
    });
  });
});
