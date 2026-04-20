import { describe, it, expect, afterEach } from "vitest";

import { runSummon } from "../nodes/HeySummon/operations/summon";
import { installFetchMock, type MockFetchHandle } from "./test-utils";

const credentials = {
  apiKey: "hs_cli_test",
  baseUrl: "http://hs.test",
  e2eEnabled: true,
};

let handle: MockFetchHandle | null = null;
afterEach(() => {
  handle?.restore();
  handle = null;
});

describe("Summon — happy path (T1)", () => {
  it("submits, polls, and returns a success envelope on responded", async () => {
    let pollCount = 0;
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: ({ body }) => {
          const b = body as Record<string, unknown>;
          expect(typeof b.signPublicKey).toBe("string");
          expect(typeof b.encryptPublicKey).toBe("string");
          return {
            status: 200,
            body: {
              requestId: "req-happy",
              refCode: "HS-HAPPY",
              status: "pending",
              expiresAt: new Date(Date.now() + 60_000).toISOString(),
            },
          };
        },
      },
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-happy$/,
        handler: () => {
          pollCount++;
          if (pollCount < 2) {
            return {
              status: 200,
              body: {
                requestId: "req-happy",
                refCode: "HS-HAPPY",
                status: "pending",
              },
            };
          }
          return {
            status: 200,
            body: {
              requestId: "req-happy",
              refCode: "HS-HAPPY",
              status: "responded",
              response: "Yes, ship it",
              expert: { id: "e1", name: "Thomas" },
            },
          };
        },
      },
    ]);

    const result = await runSummon(
      {
        question: "Should I deploy?",
        timeoutMs: 10_000,
        pollIntervalMs: 5,
      },
      credentials,
      { sleep: () => Promise.resolve() }
    );

    if ("error" in result) {
      throw new Error(`expected success, got ${JSON.stringify(result)}`);
    }
    expect(result.status).toBe("responded");
    expect(result.requestId).toBe("req-happy");
    expect(result.refCode).toBe("HS-HAPPY");
    expect(result.response).toBe("Yes, ship it");
    expect(result.responder).toBe("Thomas");
  });
});

describe("Summon — server-side expired (T2)", () => {
  it("returns kind=expired and stops polling", async () => {
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-exp",
            refCode: "HS-EXP",
            status: "pending",
            expiresAt: new Date().toISOString(),
          },
        }),
      },
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-exp$/,
        handler: () => ({
          status: 200,
          body: { requestId: "req-exp", refCode: "HS-EXP", status: "expired" },
        }),
      },
    ]);

    const result = await runSummon(
      { question: "ping", timeoutMs: 5_000, pollIntervalMs: 5 },
      credentials,
      { sleep: () => Promise.resolve() }
    );

    if (!("error" in result)) {
      throw new Error("expected error envelope");
    }
    expect(result.error.kind).toBe("expired");
    expect(result.error.retriable).toBe(false);
    expect(result.error.requestId).toBe("req-exp");
  });
});

describe("Summon — local timeout (T3)", () => {
  it("returns kind=timeout when deadline elapses", async () => {
    let pollCalls = 0;
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-to",
            refCode: null,
            status: "pending",
            expiresAt: new Date().toISOString(),
          },
        }),
      },
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-to$/,
        handler: () => {
          pollCalls++;
          return {
            status: 200,
            body: { requestId: "req-to", refCode: null, status: "pending" },
          };
        },
      },
      {
        method: "POST",
        matcher: /\/api\/v1\/help\/req-to\/timeout$/,
        handler: () => ({ status: 200, body: { ok: true } }),
      },
    ]);

    let t = 1_000;
    const result = await runSummon(
      { question: "slow", timeoutMs: 50, pollIntervalMs: 10 },
      credentials,
      {
        sleep: () => Promise.resolve(),
        now: () => {
          t += 30;
          return t;
        },
      }
    );

    if (!("error" in result)) {
      throw new Error("expected error envelope");
    }
    expect(result.error.kind).toBe("timeout");
    expect(result.error.retriable).toBe(true);
    expect(pollCalls).toBeGreaterThanOrEqual(1);
  });
});

describe("Summon — network error on submit (T4)", () => {
  it("returns kind=network and retriable=true", async () => {
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => {
          throw new TypeError("ECONNREFUSED");
        },
      },
    ]);

    const result = await runSummon(
      { question: "ping", timeoutMs: 1_000, pollIntervalMs: 5 },
      credentials,
      { sleep: () => Promise.resolve() }
    );

    if (!("error" in result)) {
      throw new Error("expected error envelope");
    }
    expect(result.error.kind).toBe("network");
    expect(result.error.retriable).toBe(true);
  });
});

describe("Summon — Guard rejection on POST /help (T5)", () => {
  it("returns kind=guard_rejected with the Guard message", async () => {
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => ({
          status: 400,
          body: {
            error: "guard_rejected",
            reason: "guard_blocked_pii",
            message: "Question contains PII the Guard refuses to forward.",
          },
        }),
      },
    ]);

    const result = await runSummon(
      { question: "leak my SSN", timeoutMs: 1_000, pollIntervalMs: 5 },
      credentials,
      { sleep: () => Promise.resolve() }
    );

    if (!("error" in result)) {
      throw new Error("expected error envelope");
    }
    expect(result.error.kind).toBe("guard_rejected");
    expect(result.error.message).toContain("PII");
    expect(result.error.httpStatus).toBe(400);
  });
});
