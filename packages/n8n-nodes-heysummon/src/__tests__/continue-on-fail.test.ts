import { describe, it, expect, afterEach } from "vitest";

import { HeySummon } from "../nodes/HeySummon/HeySummon.node";
import { installFetchMock, type MockFetchHandle } from "./test-utils";

let handle: MockFetchHandle | null = null;
afterEach(() => {
  handle?.restore();
  handle = null;
});

interface ParamMap {
  operation: string;
  question?: string;
  context?: string;
  expertName?: string;
  requiresApproval?: boolean;
  timeoutMs?: number;
  pollIntervalMs?: number;
  requestId?: string;
}

function makeExecuteContext(opts: {
  params: ParamMap;
  continueOnFail: boolean;
}) {
  return {
    getInputData: () => [{ json: {} }],
    getCredentials: async () => ({
      apiKey: "hs_cli_test",
      baseUrl: "http://hs.test",
      e2eEnabled: true,
    }),
    getNodeParameter: (name: string, _index: number, fallback?: unknown) => {
      const value = (opts.params as unknown as Record<string, unknown>)[name];
      return value !== undefined ? value : fallback;
    },
    continueOnFail: () => opts.continueOnFail,
    getNode: () => ({ name: "HeySummon", type: "heySummon" }),
  };
}

describe("HeySummon node — Continue On Fail (T6)", () => {
  it("emits errors on the second output port when continueOnFail is true", async () => {
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => ({
          status: 400,
          body: {
            reason: "guard_blocked",
            message: "blocked by guard",
          },
        }),
      },
    ]);

    const ctx = makeExecuteContext({
      params: { operation: "summon", question: "ping", timeoutMs: 1_000, pollIntervalMs: 5 },
      continueOnFail: true,
    });

    const node = new HeySummon();
    const result = await node.execute.call(
      ctx as unknown as Parameters<typeof node.execute>[0] extends never
        ? never
        : unknown as never
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(0);
    expect(result[1]).toHaveLength(1);
    const errJson = result[1][0].json as { error: { kind: string } };
    expect(errJson.error.kind).toBe("guard_rejected");
  });

  it("throws NodeOperationError when continueOnFail is false", async () => {
    handle = installFetchMock([
      {
        method: "POST",
        matcher: "/api/v1/help",
        handler: () => ({
          status: 400,
          body: { reason: "guard_blocked", message: "blocked" },
        }),
      },
    ]);

    const ctx = makeExecuteContext({
      params: { operation: "summon", question: "ping", timeoutMs: 1_000, pollIntervalMs: 5 },
      continueOnFail: false,
    });

    const node = new HeySummon();
    await expect(
      node.execute.call(
        ctx as unknown as Parameters<typeof node.execute>[0] extends never
          ? never
          : unknown as never
      )
    ).rejects.toThrow(/blocked/);
  });
});
