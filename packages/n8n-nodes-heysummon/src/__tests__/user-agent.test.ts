import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runSummon } from "../nodes/HeySummon/operations/summon";
import { runGetStatus } from "../nodes/HeySummon/operations/getStatus";
import { _resetUserAgentCache, getUserAgent } from "../nodes/HeySummon/lib/user-agent";
import { installFetchMock, type MockFetchHandle } from "./test-utils";

const credentials = {
  apiKey: "hs_cli_test",
  baseUrl: "http://hs.test",
  e2eEnabled: true,
};

let pkgVersion: string;

beforeEach(() => {
  _resetUserAgentCache();
  const pkg = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "package.json"), "utf8")
  ) as { version: string };
  pkgVersion = pkg.version;
});

let handle: MockFetchHandle | null = null;
afterEach(() => {
  handle?.restore();
  handle = null;
});

describe("User-Agent attribution (T9)", () => {
  it("sets the User-Agent header on POST /help and GET /help/:id during Summon", async () => {
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-1",
            refCode: "HS-UA",
            status: "pending",
            expiresAt: new Date().toISOString(),
          },
        }),
      },
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-1$/,
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-1",
            refCode: "HS-UA",
            status: "responded",
            response: "OK",
          },
        }),
      },
    ]);

    const result = await runSummon(
      { question: "ping", timeoutMs: 5_000, pollIntervalMs: 10 },
      credentials,
      { sleep: () => Promise.resolve() }
    );

    expect("error" in result).toBe(false);
    expect(handle.calls.length).toBeGreaterThanOrEqual(2);
    const expectedUA = `n8n-nodes-heysummon/${pkgVersion} (n8n; node)`;
    expect(getUserAgent()).toBe(expectedUA);
    for (const call of handle.calls) {
      expect(call.headers.get("user-agent")).toBe(expectedUA);
    }
  });

  it("sets the User-Agent header on GET /help/:id during Get Status", async () => {
    handle = installFetchMock([
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-2$/,
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-2",
            refCode: "HS-UA",
            status: "pending",
          },
        }),
      },
    ]);

    await runGetStatus({ requestId: "req-2" }, credentials);
    const expectedUA = `n8n-nodes-heysummon/${pkgVersion} (n8n; node)`;
    expect(handle.calls[0].headers.get("user-agent")).toBe(expectedUA);
  });
});
