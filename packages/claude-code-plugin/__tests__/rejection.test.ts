import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HeySummonClient } from "@heysummon/consumer-sdk";
import { summon } from "../src/summon.js";
import { SummonRejectedError } from "../src/errors.js";

const BASE = "http://test.heysummon.local";
const API_KEY = "hs_cli_test000";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function testClient(): HeySummonClient {
  return new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: false });
}

describe("summon — rejection path", () => {
  it("throws SummonRejectedError when the server rejects up front", async () => {
    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          rejected: true,
          reason: "expert_offline",
          message: "No expert is available right now",
          nextAvailableAt: new Date(Date.now() + 3_600_000).toISOString(),
        })
      )
    );

    try {
      await summon(
        { question: "Anyone?" },
        {
          client: testClient(),
          config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
          pollIntervals: [1],
          sleep: async () => {},
        }
      );
      throw new Error("expected SummonRejectedError");
    } catch (err) {
      expect(err).toBeInstanceOf(SummonRejectedError);
      const rej = err as SummonRejectedError;
      expect(rej.reason).toBe("expert_offline");
      expect(rej.message).toBe("No expert is available right now");
    }
  });

  it("throws SummonRejectedError when the polled status resolves to cancelled", async () => {
    const sequence = ["pending", "cancelled"];
    let i = 0;

    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-cancel",
          refCode: "HS-CANCEL",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      ),
      http.get(`${BASE}/api/v1/help/req-cancel`, () => {
        const status = sequence[Math.min(i, sequence.length - 1)];
        i += 1;
        return HttpResponse.json({ requestId: "req-cancel", status });
      })
    );

    try {
      await summon(
        { question: "Proceed?" },
        {
          client: testClient(),
          config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
          pollIntervals: [1],
          sleep: async () => {},
        }
      );
      throw new Error("expected SummonRejectedError");
    } catch (err) {
      expect(err).toBeInstanceOf(SummonRejectedError);
      const rej = err as SummonRejectedError;
      expect(rej.status).toBe("cancelled");
      expect(rej.requestId).toBe("req-cancel");
    }
  });

  it("throws SummonRejectedError when the status resolves to expired", async () => {
    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-expired",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      ),
      http.get(`${BASE}/api/v1/help/req-expired`, () =>
        HttpResponse.json({ requestId: "req-expired", status: "expired" })
      )
    );

    await expect(
      summon(
        { question: "Still here?" },
        {
          client: testClient(),
          config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
          pollIntervals: [1],
          sleep: async () => {},
        }
      )
    ).rejects.toBeInstanceOf(SummonRejectedError);
  });
});
