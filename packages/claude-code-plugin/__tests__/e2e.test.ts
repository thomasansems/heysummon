import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HeySummonClient } from "@heysummon/consumer-sdk";
import { summon } from "../src/summon.js";

const BASE = "http://test.heysummon.local";
const API_KEY = "hs_cli_test000";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * The E2E dashboard route writes the expert reply to the encrypted Message
 * table and flips `HelpRequest.status` to `responded`, but never populates
 * `HelpRequest.response`. These tests mirror that shape so the plugin must
 * fall back to `/api/v1/messages/:requestId` to resume the agent.
 */
describe("summon — e2e round-trip", () => {
  it("sends freshly-generated public keys when the SDK runs with e2e enabled", async () => {
    let body: Record<string, unknown> = {};

    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          requestId: "req-e2e-keys",
          refCode: "HS-E2E-KEYS",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      }),
      http.get(`${BASE}/api/v1/help/req-e2e-keys`, () =>
        HttpResponse.json({
          requestId: "req-e2e-keys",
          status: "responded",
        })
      ),
      http.get(`${BASE}/api/v1/messages/req-e2e-keys`, () =>
        HttpResponse.json({
          requestId: "req-e2e-keys",
          refCode: "HS-E2E-KEYS",
          status: "responded",
          consumerSignPubKey: null,
          consumerEncryptPubKey: null,
          expertSignPubKey: null,
          expertEncryptPubKey: null,
          messages: [
            {
              id: "msg-1",
              from: "expert",
              iv: "plaintext",
              plaintext: "Ship it.",
              messageId: "mid-1",
              createdAt: new Date().toISOString(),
            },
          ],
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      )
    );

    const result = await summon(
      { question: "Encrypted question" },
      {
        client: new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: true }),
        config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
        pollIntervals: [1],
        sleep: async () => {},
      }
    );

    expect(result.response).toBe("Ship it.");

    // Each key is a SPKI-encoded public key as hex. X25519 SPKI headers give a
    // deterministic-length string; we just assert we received plausible hex
    // material for both key slots rather than duplicating SDK crypto tests.
    const signPub = body.signPublicKey as string | undefined;
    const encPub = body.encryptPublicKey as string | undefined;
    expect(typeof signPub).toBe("string");
    expect(typeof encPub).toBe("string");
    expect(signPub?.length).toBeGreaterThan(40);
    expect(encPub?.length).toBeGreaterThan(40);
    expect(signPub).toMatch(/^[0-9a-f]+$/);
    expect(encPub).toMatch(/^[0-9a-f]+$/);
  });

  it("falls back to /messages when status is `responded` with no response (real E2E shape)", async () => {
    let messagesCalls = 0;

    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-e2e",
          refCode: "HS-E2E",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      ),
      // Real E2E shape: status flips to `responded`, but `response` is absent.
      http.get(`${BASE}/api/v1/help/req-e2e`, () =>
        HttpResponse.json({
          requestId: "req-e2e",
          refCode: "HS-E2E",
          status: "responded",
        })
      ),
      http.get(`${BASE}/api/v1/messages/req-e2e`, () => {
        messagesCalls += 1;
        return HttpResponse.json({
          requestId: "req-e2e",
          refCode: "HS-E2E",
          status: "responded",
          consumerSignPubKey: null,
          consumerEncryptPubKey: null,
          expertSignPubKey: null,
          expertEncryptPubKey: null,
          messages: [
            {
              id: "msg-consumer",
              from: "consumer",
              iv: "plaintext",
              plaintext: "Should I proceed?",
              messageId: "mid-c",
              createdAt: new Date().toISOString(),
            },
            {
              id: "msg-expert",
              from: "expert",
              iv: "plaintext",
              plaintext: "Yes, proceed with the migration.",
              messageId: "mid-e",
              createdAt: new Date().toISOString(),
            },
          ],
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      })
    );

    const result = await summon(
      { question: "Should I proceed?" },
      {
        client: new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: true }),
        config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
        pollIntervals: [1],
        sleep: async () => {},
      }
    );

    expect(result.status).toBe("responded");
    expect(result.response).toBe("Yes, proceed with the migration.");
    expect(messagesCalls).toBe(1);
  });

  it("keeps polling when status is terminal but the expert message has not been persisted yet", async () => {
    let messagesCalls = 0;

    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-race",
          refCode: "HS-RACE",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      ),
      http.get(`${BASE}/api/v1/help/req-race`, () =>
        HttpResponse.json({
          requestId: "req-race",
          refCode: "HS-RACE",
          status: "responded",
        })
      ),
      // First /messages call: status flipped but the expert row has not
      // landed yet. Second call: expert plaintext is now visible.
      http.get(`${BASE}/api/v1/messages/req-race`, () => {
        messagesCalls += 1;
        const messages =
          messagesCalls === 1
            ? []
            : [
                {
                  id: "msg-expert",
                  from: "expert",
                  iv: "plaintext",
                  plaintext: "Go ahead.",
                  messageId: "mid-e",
                  createdAt: new Date().toISOString(),
                },
              ];
        return HttpResponse.json({
          requestId: "req-race",
          refCode: "HS-RACE",
          status: "responded",
          consumerSignPubKey: null,
          consumerEncryptPubKey: null,
          expertSignPubKey: null,
          expertEncryptPubKey: null,
          messages,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        });
      })
    );

    const result = await summon(
      { question: "Race?" },
      {
        client: new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: true }),
        config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
        pollIntervals: [1],
        sleep: async () => {},
      }
    );

    expect(result.response).toBe("Go ahead.");
    expect(messagesCalls).toBe(2);
  });
});
