import { describe, it, expect, afterEach } from "vitest";

import { runGetStatus } from "../nodes/HeySummon/operations/getStatus";
import { installFetchMock, type MockFetchHandle } from "./test-utils";

let handle: MockFetchHandle | null = null;
afterEach(() => {
  handle?.restore();
  handle = null;
});

describe("Get Status — happy path, E2E on (T7)", () => {
  it("returns metadata with response: null when E2E is on", async () => {
    handle = installFetchMock([
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-7$/,
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-7",
            refCode: "HS-7",
            status: "responded",
            response: "leaked plaintext from server",
            expert: { id: "e1", name: "Thomas" },
          },
        }),
      },
    ]);

    const result = await runGetStatus(
      { requestId: "req-7" },
      { apiKey: "k", baseUrl: "http://hs.test", e2eEnabled: true }
    );

    if ("error" in result) throw new Error("expected success");
    expect(result.requestId).toBe("req-7");
    expect(result.status).toBe("responded");
    expect(result.responder).toBe("Thomas");
    expect(result.response).toBeNull();
  });

  it("returns the plaintext response when E2E is off", async () => {
    handle = installFetchMock([
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/req-8$/,
        handler: () => ({
          status: 200,
          body: {
            requestId: "req-8",
            refCode: "HS-8",
            status: "responded",
            response: "Yes, do it",
          },
        }),
      },
    ]);

    const result = await runGetStatus(
      { requestId: "req-8" },
      { apiKey: "k", baseUrl: "http://hs.test", e2eEnabled: false }
    );

    if ("error" in result) throw new Error("expected success");
    expect(result.response).toBe("Yes, do it");
  });
});

describe("Get Status — invalid requestId (T8)", () => {
  it("returns kind=http with httpStatus=404", async () => {
    handle = installFetchMock([
      {
        method: "GET",
        matcher: /\/api\/v1\/help\/missing$/,
        handler: () => ({
          status: 404,
          body: { error: "Not found" },
        }),
      },
    ]);

    const result = await runGetStatus(
      { requestId: "missing" },
      { apiKey: "k", baseUrl: "http://hs.test", e2eEnabled: true }
    );
    if (!("error" in result)) throw new Error("expected error envelope");
    expect(result.error.kind).toBe("http");
    expect(result.error.httpStatus).toBe(404);
    expect(result.error.retriable).toBe(false);
  });

  it("returns kind=validation when requestId is empty", async () => {
    const result = await runGetStatus(
      { requestId: "" },
      { apiKey: "k", baseUrl: "http://hs.test", e2eEnabled: true }
    );
    if (!("error" in result)) throw new Error("expected error envelope");
    expect(result.error.kind).toBe("validation");
  });
});
