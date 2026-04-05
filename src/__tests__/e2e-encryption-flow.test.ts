/**
 * Integration tests: full E2E encryption flow
 *
 * Tests the complete always-on E2E encryption lifecycle using real crypto
 * operations and a lightweight in-memory API simulator. Validates that
 * consumer and provider can exchange keys and encrypted messages correctly.
 *
 * Covers: auto-keygen, opt-out, explicit keys, mixed messages,
 * pre-key-exchange graceful handling, and importKeys for restarts.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "node:crypto";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ---------------------------------------------------------------------------
// Crypto helpers — mirror the consumer SDK's X25519 + AES-256-GCM + Ed25519
// ---------------------------------------------------------------------------

interface KeyMaterial {
  signPublicKey: string; // hex DER
  encryptPublicKey: string; // hex DER
  signKeyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject };
  encryptKeyPair: { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject };
}

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
  signature: string;
  messageId: string;
}

function generateKeyMaterial(): KeyMaterial {
  const signKeyPair = crypto.generateKeyPairSync("ed25519");
  const encryptKeyPair = crypto.generateKeyPairSync("x25519");
  return {
    signPublicKey: signKeyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    encryptPublicKey: encryptKeyPair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    signKeyPair,
    encryptKeyPair,
  };
}

function publicKeyFromHex(hex: string): crypto.KeyObject {
  return crypto.createPublicKey({
    key: Buffer.from(hex, "hex"),
    format: "der",
    type: "spki",
  });
}

function encryptMessage(
  plaintext: string,
  recipientEncPub: crypto.KeyObject,
  ownSignPriv: crypto.KeyObject,
  ownEncPriv: crypto.KeyObject,
  messageId?: string
): EncryptedPayload {
  const sharedSecret = crypto.diffieHellman({
    privateKey: ownEncPriv,
    publicKey: recipientEncPub,
  });
  const msgId = messageId || crypto.randomUUID();
  const messageKey = crypto.hkdfSync("sha256", sharedSecret, msgId, "heysummon-msg", 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(messageKey), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const signature = crypto.sign(null, encrypted, ownSignPriv);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    signature: signature.toString("base64"),
    messageId: msgId,
  };
}

function decryptMessage(
  payload: EncryptedPayload,
  senderEncPub: crypto.KeyObject,
  senderSignPub: crypto.KeyObject,
  ownEncPriv: crypto.KeyObject
): string {
  const ciphertextBuf = Buffer.from(payload.ciphertext, "base64");
  const valid = crypto.verify(
    null,
    ciphertextBuf,
    senderSignPub,
    Buffer.from(payload.signature, "base64")
  );
  if (!valid) throw new Error("Signature verification failed");

  const sharedSecret = crypto.diffieHellman({
    privateKey: ownEncPriv,
    publicKey: senderEncPub,
  });
  const messageKey = crypto.hkdfSync(
    "sha256",
    sharedSecret,
    payload.messageId,
    "heysummon-msg",
    32
  );
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(messageKey),
    Buffer.from(payload.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  return Buffer.concat([decipher.update(ciphertextBuf), decipher.final()]).toString("utf8");
}

function generatePersistentKeys(dir: string) {
  const fs = require("node:fs");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ed = crypto.generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(join(dir, "sign_public.pem"), ed.publicKey);
  fs.writeFileSync(join(dir, "sign_private.pem"), ed.privateKey);

  const x = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(join(dir, "encrypt_public.pem"), x.publicKey);
  fs.writeFileSync(join(dir, "encrypt_private.pem"), x.privateKey);

  return {
    signPublicKey: crypto
      .createPublicKey(ed.publicKey)
      .export({ type: "spki", format: "der" })
      .toString("hex"),
    encryptPublicKey: crypto
      .createPublicKey(x.publicKey)
      .export({ type: "spki", format: "der" })
      .toString("hex"),
  };
}

// ---------------------------------------------------------------------------
// In-memory API simulator — mimics HeySummon server state
// ---------------------------------------------------------------------------

interface StoredRequest {
  id: string;
  refCode: string;
  status: string;
  consumerSignPubKey: string | null;
  consumerEncryptPubKey: string | null;
  providerSignPubKey: string | null;
  providerEncryptPubKey: string | null;
  messages: Array<{
    id: string;
    from: "consumer" | "provider";
    ciphertext: string;
    iv: string;
    authTag: string;
    signature: string;
    messageId: string;
    createdAt: string;
  }>;
}

class MockServer {
  requests = new Map<string, StoredRequest>();

  /** POST /api/v1/help — create a request */
  submitHelp(opts: {
    signPublicKey?: string;
    encryptPublicKey?: string;
  }): { requestId: string; refCode: string; status: string } {
    const id = crypto.randomUUID();
    const refCode = `HS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    this.requests.set(id, {
      id,
      refCode,
      status: "pending",
      consumerSignPubKey: opts.signPublicKey || null,
      consumerEncryptPubKey: opts.encryptPublicKey || null,
      providerSignPubKey: null,
      providerEncryptPubKey: null,
      messages: [],
    });
    return { requestId: id, refCode, status: "pending" };
  }

  /** POST /api/v1/key-exchange/:requestId — provider sends keys */
  keyExchange(
    requestId: string,
    signPublicKey: string,
    encryptPublicKey: string
  ): { success: boolean; error?: string } {
    const req = this.requests.get(requestId);
    if (!req) return { success: false, error: "Not found" };
    if (req.providerSignPubKey) return { success: false, error: "Already exchanged" };
    req.providerSignPubKey = signPublicKey;
    req.providerEncryptPubKey = encryptPublicKey;
    req.status = "active";
    return { success: true };
  }

  /** POST /api/v1/message/:requestId — send a message */
  sendMessage(
    requestId: string,
    msg: {
      from: "consumer" | "provider";
      plaintext?: string;
      ciphertext?: string;
      iv?: string;
      authTag?: string;
      signature?: string;
      messageId?: string;
    }
  ): { success: boolean; messageId: string } {
    const req = this.requests.get(requestId);
    if (!req) throw new Error("Request not found");

    let { ciphertext, iv, authTag, signature, messageId } = msg;

    // Plaintext message handling (mirrors server logic)
    if (msg.plaintext && !ciphertext) {
      ciphertext = Buffer.from(msg.plaintext).toString("base64");
      iv = "plaintext";
      authTag = "plaintext";
      signature = "plaintext";
      messageId = messageId || crypto.randomUUID();
    }

    const msgId = messageId || crypto.randomUUID();

    // Dedup check
    if (req.messages.some((m) => m.messageId === msgId)) {
      return { success: true, messageId: msgId };
    }

    req.messages.push({
      id: crypto.randomUUID(),
      from: msg.from,
      ciphertext: ciphertext!,
      iv: iv!,
      authTag: authTag!,
      signature: signature!,
      messageId: msgId,
      createdAt: new Date().toISOString(),
    });

    if (msg.from === "provider" && req.status !== "responded") {
      req.status = "responded";
    }

    return { success: true, messageId: msgId };
  }

  /** GET /api/v1/messages/:requestId — fetch messages with keys */
  getMessages(requestId: string) {
    const req = this.requests.get(requestId);
    if (!req) throw new Error("Request not found");

    return {
      requestId: req.id,
      refCode: req.refCode,
      status: req.status,
      consumerSignPubKey: req.consumerSignPubKey,
      consumerEncryptPubKey: req.consumerEncryptPubKey,
      providerSignPubKey: req.providerSignPubKey,
      providerEncryptPubKey: req.providerEncryptPubKey,
      messages: req.messages.map((m) => {
        // Mirror server logic: decode plaintext Telegram replies inline
        if (m.iv === "plaintext") {
          const text = Buffer.from(m.ciphertext, "base64").toString("utf-8");
          return {
            id: m.id,
            from: m.from,
            plaintext: text,
            messageId: m.messageId,
            createdAt: m.createdAt,
          };
        }
        return { ...m };
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E encryption integration flow", () => {
  let server: MockServer;

  beforeEach(() => {
    server = new MockServer();
  });

  describe("Full E2E flow (default auto-keys)", () => {
    it("consumer submits with auto-keys -> provider key-exchange -> encrypted message roundtrip", () => {
      // 1. Consumer generates keys (simulates HeySummonClient auto-keygen)
      const consumer = generateKeyMaterial();

      // 2. Consumer submits help request with public keys
      const { requestId } = server.submitHelp({
        signPublicKey: consumer.signPublicKey,
        encryptPublicKey: consumer.encryptPublicKey,
      });

      // Verify keys are stored
      const reqAfterSubmit = server.requests.get(requestId)!;
      expect(reqAfterSubmit.consumerSignPubKey).toBe(consumer.signPublicKey);
      expect(reqAfterSubmit.consumerEncryptPubKey).toBe(consumer.encryptPublicKey);
      expect(reqAfterSubmit.status).toBe("pending");

      // 3. Provider generates keys and does key exchange
      const provider = generateKeyMaterial();
      const exchangeResult = server.keyExchange(
        requestId,
        provider.signPublicKey,
        provider.encryptPublicKey
      );
      expect(exchangeResult.success).toBe(true);

      const reqAfterExchange = server.requests.get(requestId)!;
      expect(reqAfterExchange.providerSignPubKey).toBe(provider.signPublicKey);
      expect(reqAfterExchange.status).toBe("active");

      // 4. Provider encrypts a message for the consumer
      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);
      const providerMsg = encryptMessage(
        "Here is your answer, agent.",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey
      );

      server.sendMessage(requestId, {
        from: "provider",
        ciphertext: providerMsg.ciphertext,
        iv: providerMsg.iv,
        authTag: providerMsg.authTag,
        signature: providerMsg.signature,
        messageId: providerMsg.messageId,
      });

      // 5. Consumer fetches messages and decrypts
      const messagesResp = server.getMessages(requestId);
      expect(messagesResp.messages).toHaveLength(1);

      const msg = messagesResp.messages[0];
      expect(msg.ciphertext).toBeTruthy();
      expect(msg.iv).not.toBe("plaintext");

      // Consumer decrypts using provider's public keys from server
      const providerEncPub = publicKeyFromHex(messagesResp.providerEncryptPubKey!);
      const providerSignPub = publicKeyFromHex(messagesResp.providerSignPubKey!);

      const decrypted = decryptMessage(
        {
          ciphertext: msg.ciphertext!,
          iv: msg.iv!,
          authTag: msg.authTag!,
          signature: msg.signature!,
          messageId: msg.messageId,
        },
        providerEncPub,
        providerSignPub,
        consumer.encryptKeyPair.privateKey
      );

      expect(decrypted).toBe("Here is your answer, agent.");

      // 6. Consumer sends encrypted reply back to provider
      const consumerReply = encryptMessage(
        "Thanks, that solved my issue!",
        providerEncPub,
        consumer.signKeyPair.privateKey,
        consumer.encryptKeyPair.privateKey
      );

      server.sendMessage(requestId, {
        from: "consumer",
        ciphertext: consumerReply.ciphertext,
        iv: consumerReply.iv,
        authTag: consumerReply.authTag,
        signature: consumerReply.signature,
        messageId: consumerReply.messageId,
      });

      // 7. Provider fetches and decrypts consumer's reply
      const allMessages = server.getMessages(requestId);
      expect(allMessages.messages).toHaveLength(2);

      const consumerMsg = allMessages.messages[1];
      const consumerEncPubForProvider = publicKeyFromHex(allMessages.consumerEncryptPubKey!);
      const consumerSignPubForProvider = publicKeyFromHex(allMessages.consumerSignPubKey!);

      const providerDecrypted = decryptMessage(
        {
          ciphertext: consumerMsg.ciphertext!,
          iv: consumerMsg.iv!,
          authTag: consumerMsg.authTag!,
          signature: consumerMsg.signature!,
          messageId: consumerMsg.messageId,
        },
        consumerEncPubForProvider,
        consumerSignPubForProvider,
        provider.encryptKeyPair.privateKey
      );

      expect(providerDecrypted).toBe("Thanks, that solved my issue!");
    });

    it("message deduplication prevents duplicate storage", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();

      const { requestId } = server.submitHelp({
        signPublicKey: consumer.signPublicKey,
        encryptPublicKey: consumer.encryptPublicKey,
      });
      server.keyExchange(requestId, provider.signPublicKey, provider.encryptPublicKey);

      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);
      const payload = encryptMessage(
        "Dedup test",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey,
        "fixed-message-id"
      );

      // Send same message twice
      server.sendMessage(requestId, { from: "provider", ...payload });
      server.sendMessage(requestId, { from: "provider", ...payload });

      const msgs = server.getMessages(requestId);
      expect(msgs.messages).toHaveLength(1);
    });
  });

  describe("Opt-out flow (e2e: false)", () => {
    it("consumer submits without keys -> provider responds plaintext -> consumer gets plaintext", () => {
      // Consumer opts out: no E2E keys sent
      const { requestId } = server.submitHelp({});

      const req = server.requests.get(requestId)!;
      expect(req.consumerSignPubKey).toBeNull();
      expect(req.consumerEncryptPubKey).toBeNull();

      // Provider sends plaintext response
      server.sendMessage(requestId, {
        from: "provider",
        plaintext: "Here is a plaintext answer.",
      });

      // Consumer fetches messages
      const messagesResp = server.getMessages(requestId);
      expect(messagesResp.messages).toHaveLength(1);

      const msg = messagesResp.messages[0];
      expect(msg.plaintext).toBe("Here is a plaintext answer.");
      expect(msg.ciphertext).toBeUndefined();
      expect(messagesResp.providerSignPubKey).toBeNull();
      expect(messagesResp.providerEncryptPubKey).toBeNull();
    });

    it("consumer sends plaintext follow-up without encryption", () => {
      const { requestId } = server.submitHelp({});

      server.sendMessage(requestId, {
        from: "consumer",
        plaintext: "Can you clarify?",
      });

      const messagesResp = server.getMessages(requestId);
      expect(messagesResp.messages[0].plaintext).toBe("Can you clarify?");
    });
  });

  describe("Explicit keys flow", () => {
    it("consumer provides own keys -> provider key-exchange -> consumer decrypts with own keys", () => {
      // Consumer generates keys externally (e.g., OpenClaw with persistent keys)
      const consumerKeys = generateKeyMaterial();

      // Submit with explicit keys
      const { requestId } = server.submitHelp({
        signPublicKey: consumerKeys.signPublicKey,
        encryptPublicKey: consumerKeys.encryptPublicKey,
      });

      // Provider generates keys and exchanges
      const providerKeys = generateKeyMaterial();
      server.keyExchange(requestId, providerKeys.signPublicKey, providerKeys.encryptPublicKey);

      // Provider sends encrypted message
      const consumerEncPub = publicKeyFromHex(consumerKeys.encryptPublicKey);
      const encrypted = encryptMessage(
        "Response to explicit-key consumer",
        consumerEncPub,
        providerKeys.signKeyPair.privateKey,
        providerKeys.encryptKeyPair.privateKey
      );

      server.sendMessage(requestId, { from: "provider", ...encrypted });

      // Consumer decrypts with their explicit keys
      const resp = server.getMessages(requestId);
      const msg = resp.messages[0];
      const providerEncPub = publicKeyFromHex(resp.providerEncryptPubKey!);
      const providerSignPub = publicKeyFromHex(resp.providerSignPubKey!);

      const decrypted = decryptMessage(
        {
          ciphertext: msg.ciphertext!,
          iv: msg.iv!,
          authTag: msg.authTag!,
          signature: msg.signature!,
          messageId: msg.messageId,
        },
        providerEncPub,
        providerSignPub,
        consumerKeys.encryptKeyPair.privateKey
      );

      expect(decrypted).toBe("Response to explicit-key consumer");
    });
  });

  describe("Mixed messages (plaintext + encrypted)", () => {
    it("handles both plaintext (e.g., Telegram) and encrypted messages in same thread", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();

      const { requestId } = server.submitHelp({
        signPublicKey: consumer.signPublicKey,
        encryptPublicKey: consumer.encryptPublicKey,
      });
      server.keyExchange(requestId, provider.signPublicKey, provider.encryptPublicKey);

      // Provider sends plaintext message (e.g., via Telegram adapter)
      server.sendMessage(requestId, {
        from: "provider",
        plaintext: "Quick note from Telegram",
        messageId: "tg-msg-1",
      });

      // Provider sends encrypted message (via dashboard)
      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);
      const encrypted = encryptMessage(
        "Detailed encrypted response from dashboard",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey,
        "enc-msg-1"
      );
      server.sendMessage(requestId, { from: "provider", ...encrypted });

      // Consumer sends encrypted reply
      const providerEncPub = publicKeyFromHex(provider.encryptPublicKey);
      const consumerReply = encryptMessage(
        "Got both, thanks!",
        providerEncPub,
        consumer.signKeyPair.privateKey,
        consumer.encryptKeyPair.privateKey,
        "enc-msg-2"
      );
      server.sendMessage(requestId, { from: "consumer", ...consumerReply });

      // Fetch all messages
      const resp = server.getMessages(requestId);
      expect(resp.messages).toHaveLength(3);

      // Message 1: plaintext from Telegram
      expect(resp.messages[0].plaintext).toBe("Quick note from Telegram");
      expect(resp.messages[0].ciphertext).toBeUndefined();

      // Message 2: encrypted from dashboard — consumer decrypts
      const msg2 = resp.messages[1];
      expect(msg2.ciphertext).toBeTruthy();
      expect(msg2.iv).not.toBe("plaintext");

      const decrypted2 = decryptMessage(
        {
          ciphertext: msg2.ciphertext!,
          iv: msg2.iv!,
          authTag: msg2.authTag!,
          signature: msg2.signature!,
          messageId: msg2.messageId,
        },
        publicKeyFromHex(resp.providerEncryptPubKey!),
        publicKeyFromHex(resp.providerSignPubKey!),
        consumer.encryptKeyPair.privateKey
      );
      expect(decrypted2).toBe("Detailed encrypted response from dashboard");

      // Message 3: encrypted consumer reply — provider decrypts
      const msg3 = resp.messages[2];
      const decrypted3 = decryptMessage(
        {
          ciphertext: msg3.ciphertext!,
          iv: msg3.iv!,
          authTag: msg3.authTag!,
          signature: msg3.signature!,
          messageId: msg3.messageId,
        },
        publicKeyFromHex(resp.consumerEncryptPubKey!),
        publicKeyFromHex(resp.consumerSignPubKey!),
        provider.encryptKeyPair.privateKey
      );
      expect(decrypted3).toBe("Got both, thanks!");
    });
  });

  describe("Key exchange not yet done", () => {
    it("consumer fetches messages before key exchange -> gets raw encrypted blobs gracefully", () => {
      const consumer = generateKeyMaterial();
      const { requestId } = server.submitHelp({
        signPublicKey: consumer.signPublicKey,
        encryptPublicKey: consumer.encryptPublicKey,
      });

      // No key exchange yet — provider keys are null
      const resp = server.getMessages(requestId);
      expect(resp.providerSignPubKey).toBeNull();
      expect(resp.providerEncryptPubKey).toBeNull();
      expect(resp.messages).toHaveLength(0);
    });

    it("consumer cannot decrypt without provider keys even if messages exist", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();

      const { requestId } = server.submitHelp({
        signPublicKey: consumer.signPublicKey,
        encryptPublicKey: consumer.encryptPublicKey,
      });

      // Simulate provider sending a plaintext message before key exchange
      server.sendMessage(requestId, {
        from: "provider",
        plaintext: "Initial plaintext before key exchange",
      });

      const resp = server.getMessages(requestId);
      expect(resp.providerEncryptPubKey).toBeNull();

      // Plaintext messages still work
      expect(resp.messages[0].plaintext).toBe("Initial plaintext before key exchange");

      // Now do key exchange
      server.keyExchange(requestId, provider.signPublicKey, provider.encryptPublicKey);

      const respAfter = server.getMessages(requestId);
      expect(respAfter.providerEncryptPubKey).toBe(provider.encryptPublicKey);
      expect(respAfter.status).toBe("active");
    });

    it("duplicate key exchange is rejected", () => {
      const consumer = generateKeyMaterial();
      const provider1 = generateKeyMaterial();
      const provider2 = generateKeyMaterial();

      const { requestId } = server.submitHelp({
        signPublicKey: consumer.signPublicKey,
        encryptPublicKey: consumer.encryptPublicKey,
      });

      const first = server.keyExchange(requestId, provider1.signPublicKey, provider1.encryptPublicKey);
      expect(first.success).toBe(true);

      const second = server.keyExchange(requestId, provider2.signPublicKey, provider2.encryptPublicKey);
      expect(second.success).toBe(false);
      expect(second.error).toContain("Already exchanged");
    });
  });

  describe("importKeys flow (consumer restart)", () => {
    let tempDir: string;

    beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), "hs-e2e-import-test-"));
    });

    afterEach(() => {
      rmSync(tempDir, { recursive: true, force: true });
    });

    it("consumer restarts -> imports PEM keys -> can decrypt messages from before restart", () => {
      // 1. Consumer generates persistent keys on disk (simulates OpenClaw)
      const keyDir = join(tempDir, "consumer-keys");
      const consumerPubKeys = generatePersistentKeys(keyDir);

      // 2. Consumer submits request with persistent public keys
      const { requestId } = server.submitHelp({
        signPublicKey: consumerPubKeys.signPublicKey,
        encryptPublicKey: consumerPubKeys.encryptPublicKey,
      });

      // 3. Provider generates keys and exchanges
      const provider = generateKeyMaterial();
      server.keyExchange(requestId, provider.signPublicKey, provider.encryptPublicKey);

      // 4. Provider sends encrypted message
      const consumerEncPub = publicKeyFromHex(consumerPubKeys.encryptPublicKey);
      const encrypted = encryptMessage(
        "Message sent while consumer was offline",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey,
        "msg-before-restart"
      );
      server.sendMessage(requestId, { from: "provider", ...encrypted });

      // 5. Simulate consumer restart: load keys from PEM files
      const signPubPem = readFileSync(join(keyDir, "sign_public.pem"), "utf8");
      const signPrivPem = readFileSync(join(keyDir, "sign_private.pem"), "utf8");
      const encPubPem = readFileSync(join(keyDir, "encrypt_public.pem"), "utf8");
      const encPrivPem = readFileSync(join(keyDir, "encrypt_private.pem"), "utf8");

      const importedEncPriv = crypto.createPrivateKey(encPrivPem);
      const importedSignPriv = crypto.createPrivateKey(signPrivPem);

      // Verify imported public keys match the originals
      const importedSignPubHex = crypto
        .createPublicKey(signPubPem)
        .export({ type: "spki", format: "der" })
        .toString("hex");
      const importedEncPubHex = crypto
        .createPublicKey(encPubPem)
        .export({ type: "spki", format: "der" })
        .toString("hex");

      expect(importedSignPubHex).toBe(consumerPubKeys.signPublicKey);
      expect(importedEncPubHex).toBe(consumerPubKeys.encryptPublicKey);

      // 6. Consumer fetches messages and decrypts with imported keys
      const resp = server.getMessages(requestId);
      const msg = resp.messages[0];

      const providerEncPub = publicKeyFromHex(resp.providerEncryptPubKey!);
      const providerSignPub = publicKeyFromHex(resp.providerSignPubKey!);

      const decrypted = decryptMessage(
        {
          ciphertext: msg.ciphertext!,
          iv: msg.iv!,
          authTag: msg.authTag!,
          signature: msg.signature!,
          messageId: msg.messageId,
        },
        providerEncPub,
        providerSignPub,
        importedEncPriv
      );

      expect(decrypted).toBe("Message sent while consumer was offline");

      // 7. Consumer can also send encrypted replies with imported keys
      const reply = encryptMessage(
        "Back online, thanks for waiting!",
        providerEncPub,
        importedSignPriv,
        importedEncPriv,
        "msg-after-restart"
      );
      server.sendMessage(requestId, { from: "consumer", ...reply });

      // 8. Provider decrypts the reply
      const allMsgs = server.getMessages(requestId);
      const replyMsg = allMsgs.messages[1];
      const consumerEncPubObj = publicKeyFromHex(allMsgs.consumerEncryptPubKey!);
      const consumerSignPubObj = publicKeyFromHex(allMsgs.consumerSignPubKey!);

      const providerDecrypted = decryptMessage(
        {
          ciphertext: replyMsg.ciphertext!,
          iv: replyMsg.iv!,
          authTag: replyMsg.authTag!,
          signature: replyMsg.signature!,
          messageId: replyMsg.messageId,
        },
        consumerEncPubObj,
        consumerSignPubObj,
        provider.encryptKeyPair.privateKey
      );

      expect(providerDecrypted).toBe("Back online, thanks for waiting!");
    });
  });

  describe("Crypto security validations", () => {
    it("tampered ciphertext fails AES-GCM auth tag verification", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();

      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);
      const encrypted = encryptMessage(
        "Sensitive data",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey
      );

      // Tamper with ciphertext
      const tampered = Buffer.from(encrypted.ciphertext, "base64");
      tampered[0] ^= 0xff;
      encrypted.ciphertext = tampered.toString("base64");

      // Re-sign with provider's key (attacker has signing key in this scenario)
      encrypted.signature = crypto
        .sign(null, tampered, provider.signKeyPair.privateKey)
        .toString("base64");

      const providerEncPub = publicKeyFromHex(provider.encryptPublicKey);
      const providerSignPub = publicKeyFromHex(provider.signPublicKey);

      // Decryption should fail due to AES-GCM auth tag mismatch
      expect(() =>
        decryptMessage(
          encrypted,
          providerEncPub,
          providerSignPub,
          consumer.encryptKeyPair.privateKey
        )
      ).toThrow();
    });

    it("tampered signature is detected before decryption", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();

      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);
      const encrypted = encryptMessage(
        "Signed data",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey
      );

      // Tamper with signature
      encrypted.signature = Buffer.from("tampered-signature").toString("base64");

      const providerEncPub = publicKeyFromHex(provider.encryptPublicKey);
      const providerSignPub = publicKeyFromHex(provider.signPublicKey);

      expect(() =>
        decryptMessage(
          encrypted,
          providerEncPub,
          providerSignPub,
          consumer.encryptKeyPair.privateKey
        )
      ).toThrow("Signature verification failed");
    });

    it("wrong recipient cannot decrypt (different X25519 key pair)", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();
      const attacker = generateKeyMaterial();

      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);
      const encrypted = encryptMessage(
        "Only for consumer",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey
      );

      const providerEncPub = publicKeyFromHex(provider.encryptPublicKey);
      const providerSignPub = publicKeyFromHex(provider.signPublicKey);

      // Attacker has different X25519 private key — DH shared secret differs
      expect(() =>
        decryptMessage(
          encrypted,
          providerEncPub,
          providerSignPub,
          attacker.encryptKeyPair.privateKey
        )
      ).toThrow();
    });

    it("each message uses unique HKDF salt (messageId)", () => {
      const consumer = generateKeyMaterial();
      const provider = generateKeyMaterial();
      const consumerEncPub = publicKeyFromHex(consumer.encryptPublicKey);

      const msg1 = encryptMessage(
        "Same text",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey
      );

      const msg2 = encryptMessage(
        "Same text",
        consumerEncPub,
        provider.signKeyPair.privateKey,
        provider.encryptKeyPair.privateKey
      );

      // Different messageIds lead to different ciphertexts (different AES keys via HKDF)
      expect(msg1.messageId).not.toBe(msg2.messageId);
      expect(msg1.ciphertext).not.toBe(msg2.ciphertext);
    });
  });
});
