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

function testClient(): HeySummonClient {
  // e2e: false keeps the happy-path test free of crypto concerns; the e2e
  // suite below exercises the encryption path explicitly.
  return new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: false });
}

describe("summon — happy path", () => {
  it("submits, polls through pending -> active -> closed, and returns the expert response", async () => {
    const statusSequence = ["pending", "active", "closed"];
    let statusCalls = 0;

    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-happy",
          refCode: "HS-HAPPY",
          status: "pending",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        })
      ),
      http.get(`${BASE}/api/v1/help/req-happy`, () => {
        const idx = Math.min(statusCalls, statusSequence.length - 1);
        statusCalls += 1;
        const status = statusSequence[idx];
        return HttpResponse.json({
          requestId: "req-happy",
          refCode: "HS-HAPPY",
          status,
          response: status === "closed" ? "Ship it — looks good." : undefined,
        });
      })
    );

    const result = await summon(
      { question: "Can I deploy?" },
      {
        client: testClient(),
        config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
        pollIntervals: [1],
        sleep: async () => {},
      }
    );

    expect(result.requestId).toBe("req-happy");
    expect(result.refCode).toBe("HS-HAPPY");
    expect(result.status).toBe("closed");
    expect(result.response).toBe("Ship it — looks good.");
    expect(statusCalls).toBe(3); // pending, active, closed
  });

  it("propagates expertName and requiresApproval to the help endpoint", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          requestId: "req-approval",
          refCode: "HS-APPROVAL",
          status: "pending",
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        });
      }),
      http.get(`${BASE}/api/v1/help/req-approval`, () =>
        HttpResponse.json({
          requestId: "req-approval",
          refCode: "HS-APPROVAL",
          status: "closed",
          response: "approved",
        })
      )
    );

    const result = await summon(
      {
        question: "Approve the $500 spend?",
        expertName: "CFO",
        requiresApproval: true,
      },
      {
        client: testClient(),
        config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
        pollIntervals: [1],
        sleep: async () => {},
      }
    );

    expect(body.expertName).toBe("CFO");
    expect(body.requiresApproval).toBe(true);
    expect(result.response).toBe("approved");
  });

  it("rejects when question is empty", async () => {
    await expect(
      summon(
        { question: "   " },
        {
          client: testClient(),
          config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 100 },
          pollIntervals: [1],
          sleep: async () => {},
        }
      )
    ).rejects.toThrowError(TypeError);
  });
});
