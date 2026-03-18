import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HeySummonClient } from "../src/client.js";

const BASE = "http://test.heysummon.local";
const API_KEY = "hs_cli_test000";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function client() {
  return new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY });
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

  it("getRequestStatus() returns status object", async () => {
    server.use(
      http.get(`${BASE}/api/v1/help/req1`, () =>
        HttpResponse.json({ request: { status: "responded", refCode: "HS-TEST" } })
      )
    );

    const result = await client().getRequestStatus("req1");
    expect(result.request.status).toBe("responded");
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
