import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HeySummonClient } from "@heysummon/consumer-sdk";
import { summon } from "../src/summon.js";
import { SummonTimeoutError } from "../src/errors.js";

const BASE = "http://test.heysummon.local";
const API_KEY = "hs_cli_test000";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function testClient(): HeySummonClient {
  return new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: false });
}

describe("summon — timeout path", () => {
  it("calls reportTimeout and raises SummonTimeoutError once the timeout elapses", async () => {
    let reportTimeoutCalled = false;

    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-timeout",
          refCode: "HS-TIMEOUT",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      ),
      http.get(`${BASE}/api/v1/help/req-timeout`, () =>
        HttpResponse.json({
          requestId: "req-timeout",
          refCode: "HS-TIMEOUT",
          status: "pending",
        })
      ),
      http.post(`${BASE}/api/v1/help/req-timeout/timeout`, () => {
        reportTimeoutCalled = true;
        return HttpResponse.json({ ok: true });
      })
    );

    // Fake clock that jumps forward by 1 second on every read. Combined with a
    // 5-second timeout we converge deterministically in a handful of polls.
    let fakeNow = 1_000_000;
    const now = (): number => {
      const t = fakeNow;
      fakeNow += 1_000;
      return t;
    };

    const promise = summon(
      { question: "Ping?" },
      {
        client: testClient(),
        config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 5_000 },
        pollIntervals: [0],
        sleep: async () => {},
        now,
      }
    );

    await expect(promise).rejects.toBeInstanceOf(SummonTimeoutError);
    await promise.catch((err: unknown) => {
      expect(err).toBeInstanceOf(SummonTimeoutError);
      const timeout = err as SummonTimeoutError;
      expect(timeout.requestId).toBe("req-timeout");
      expect(timeout.lastKnownStatus).toBe("pending");
      expect(timeout.elapsedMs).toBeGreaterThanOrEqual(5_000);
    });

    expect(reportTimeoutCalled).toBe(true);
  });

  it("still throws SummonTimeoutError when reportTimeout fails on the server", async () => {
    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({
          requestId: "req-timeout-2",
          refCode: "HS-TIMEOUT-2",
          status: "pending",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        })
      ),
      http.get(`${BASE}/api/v1/help/req-timeout-2`, () =>
        HttpResponse.json({
          requestId: "req-timeout-2",
          status: "pending",
        })
      ),
      http.post(`${BASE}/api/v1/help/req-timeout-2/timeout`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );

    let fakeNow = 0;
    const now = (): number => {
      const t = fakeNow;
      fakeNow += 2_000;
      return t;
    };

    await expect(
      summon(
        { question: "Ping?" },
        {
          client: testClient(),
          config: { apiKey: API_KEY, baseUrl: BASE, timeoutMs: 3_000 },
          pollIntervals: [0],
          sleep: async () => {},
          now,
        }
      )
    ).rejects.toBeInstanceOf(SummonTimeoutError);
  });
});
