import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { HeySummonClient } from "../src/client.js";
import type { PendingEvent } from "../src/types.js";

const BASE = "http://test.heysummon.local";
const API_KEY = "hs_cli_notify_000";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function client() {
  return new HeySummonClient({ baseUrl: BASE, apiKey: API_KEY, e2e: false });
}

describe("HeySummonClient.notify()", () => {
  it("sends responseRequired=false in the submit body", async () => {
    let sentBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          requestId: "req-notify-1",
          refCode: "HS-NOTIFY-1",
          status: "pending",
          responseRequired: false,
          expiresAt: "2026-05-01T00:00:00Z",
        });
      })
    );

    const result = await client().notify({ question: "Deployed v1.2.3" });

    expect(sentBody.responseRequired).toBe(false);
    expect(result).toEqual({
      requestId: "req-notify-1",
      refCode: "HS-NOTIFY-1",
      status: "pending",
      expiresAt: "2026-05-01T00:00:00Z",
      mode: "notification",
    });
  });

  it("notify() strips any caller-supplied responseRequired", async () => {
    let sentBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          requestId: "req-notify-2",
          refCode: "HS-NOTIFY-2",
          status: "pending",
          expiresAt: "2026-05-01T00:00:00Z",
        });
      })
    );

    // Caller supplies an extra field that Omit<> prevents — but even at runtime the
    // override must land on `false`.
    await client().notify({
      question: "status ping",
      // @ts-expect-error — notify() options omit responseRequired at the type level
      responseRequired: true,
    });

    expect(sentBody.responseRequired).toBe(false);
  });

  it("throws when the server response is missing required fields", async () => {
    server.use(
      http.post(`${BASE}/api/v1/help`, () =>
        HttpResponse.json({ status: "pending" })
      )
    );

    await expect(client().notify({ question: "fyi" })).rejects.toThrow(
      /incomplete server response/i
    );
  });

  it("submitRequest() still forwards an explicit responseRequired: true", async () => {
    let sentBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          requestId: "req-help-1",
          refCode: "HS-HELP-1",
          status: "pending",
          expiresAt: "2026-05-01T00:00:00Z",
        });
      })
    );

    await client().submitRequest({
      question: "need a call",
      responseRequired: true,
    });

    expect(sentBody.responseRequired).toBe(true);
  });

  it("submitRequest() omits responseRequired when not provided (server default wins)", async () => {
    let sentBody: Record<string, unknown> = {};
    server.use(
      http.post(`${BASE}/api/v1/help`, async ({ request }) => {
        sentBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          requestId: "req-help-2",
          refCode: "HS-HELP-2",
          status: "pending",
          expiresAt: "2026-05-01T00:00:00Z",
        });
      })
    );

    await client().submitRequest({ question: "default path" });

    // JSON serialization drops undefined values, so the key is absent on the wire —
    // the server default (`true`) takes effect untouched.
    expect(sentBody.responseRequired).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */
/*  PendingEvent — shape snapshots for the three notification event variants  */
/* -------------------------------------------------------------------------- */

describe("PendingEvent — notification variants", () => {
  it("new_notification shape is stable", () => {
    const event: PendingEvent = {
      type: "new_notification",
      requestId: "req-not-1",
      refCode: "HS-NOTIFY-1",
      question: "Deployed v1.2.3",
      createdAt: "2026-04-23T10:00:00Z",
      expiresAt: "2026-04-30T10:00:00Z",
    };

    expect(event).toMatchInlineSnapshot(`
      {
        "createdAt": "2026-04-23T10:00:00Z",
        "expiresAt": "2026-04-30T10:00:00Z",
        "question": "Deployed v1.2.3",
        "refCode": "HS-NOTIFY-1",
        "requestId": "req-not-1",
        "type": "new_notification",
      }
    `);
  });

  it("notification_acknowledged shape is stable", () => {
    const event: PendingEvent = {
      type: "notification_acknowledged",
      requestId: "req-not-2",
      refCode: "HS-NOTIFY-2",
      acknowledgedAt: "2026-04-23T10:05:00Z",
    };

    expect(event).toMatchInlineSnapshot(`
      {
        "acknowledgedAt": "2026-04-23T10:05:00Z",
        "refCode": "HS-NOTIFY-2",
        "requestId": "req-not-2",
        "type": "notification_acknowledged",
      }
    `);
  });

  it("notification_expired shape is stable", () => {
    const event: PendingEvent = {
      type: "notification_expired",
      requestId: "req-not-3",
      refCode: "HS-NOTIFY-3",
      expiredAt: "2026-04-30T10:00:00Z",
    };

    expect(event).toMatchInlineSnapshot(`
      {
        "expiredAt": "2026-04-30T10:00:00Z",
        "refCode": "HS-NOTIFY-3",
        "requestId": "req-not-3",
        "type": "notification_expired",
      }
    `);
  });

  it("getPendingEvents() returns the new notification event types unchanged", async () => {
    server.use(
      http.get(`${BASE}/api/v1/events/pending`, () =>
        HttpResponse.json({
          events: [
            {
              type: "new_notification",
              requestId: "req-a",
              refCode: "HS-A",
              question: "Shipped",
              createdAt: "2026-04-23T10:00:00Z",
              expiresAt: "2026-04-30T10:00:00Z",
            },
            {
              type: "notification_acknowledged",
              requestId: "req-b",
              refCode: "HS-B",
              acknowledgedAt: "2026-04-23T10:05:00Z",
            },
            {
              type: "notification_expired",
              requestId: "req-c",
              refCode: "HS-C",
              expiredAt: "2026-04-30T10:00:00Z",
            },
          ],
        })
      )
    );

    const { events } = await client().getPendingEvents();
    expect(events.map((e) => e.type)).toEqual([
      "new_notification",
      "notification_acknowledged",
      "notification_expired",
    ]);
    expect(events[0].question).toBe("Shipped");
    expect(events[1].acknowledgedAt).toBe("2026-04-23T10:05:00Z");
    expect(events[2].expiredAt).toBe("2026-04-30T10:00:00Z");
  });
});
