import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PollingWatcher } from "../src/poller.js";
import type { HeySummonClient } from "../src/client.js";
import type { PendingEvent } from "../src/types.js";

function makeEvent(overrides: Partial<PendingEvent> = {}): PendingEvent {
  return {
    type: "new_message",
    requestId: "req1",
    refCode: "HS-TEST",
    latestMessageAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeClient(events: PendingEvent[] = []): HeySummonClient {
  return {
    getPendingEvents: vi.fn().mockResolvedValue({ events }),
    ackEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as HeySummonClient;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PollingWatcher", () => {
  it("start() does not call onEvent before first interval fires", async () => {
    const onEvent = vi.fn();
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();

    expect(onEvent).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("calls onEvent for each new event after interval fires", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const client = makeClient([makeEvent({ requestId: "req1" }), makeEvent({ requestId: "req2" })]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);

    expect(onEvent).toHaveBeenCalledTimes(2);
    watcher.stop();
  });

  it("deduplicates events with the same key on subsequent polls", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const event = makeEvent();
    const client = makeClient([event]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onEvent).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("treats events with different latestMessageAt as distinct", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const getPendingEvents = vi
      .fn()
      .mockResolvedValueOnce({ events: [makeEvent({ latestMessageAt: "2026-01-01T00:00:00Z" })] })
      .mockResolvedValueOnce({ events: [makeEvent({ latestMessageAt: "2026-01-01T00:01:00Z" })] });

    const client = { getPendingEvents, ackEvent: vi.fn().mockResolvedValue(undefined) } as unknown as HeySummonClient;
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onEvent).toHaveBeenCalledTimes(2);
    watcher.stop();
  });

  it("calls ackEvent after processing each event", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);

    expect(client.ackEvent).toHaveBeenCalledWith("req1");
    watcher.stop();
  });

  it("calls onError when getPendingEvents throws", async () => {
    const onError = vi.fn();
    const client = {
      getPendingEvents: vi.fn().mockRejectedValue(new Error("Network failure")),
      ackEvent: vi.fn(),
    } as unknown as HeySummonClient;

    const watcher = new PollingWatcher({ client, onEvent: vi.fn(), onError, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Network failure" }));
    watcher.stop();
  });

  it("calls onError when onEvent throws (does not crash the watcher)", async () => {
    const onError = vi.fn();
    const onEvent = vi.fn().mockRejectedValue(new Error("Handler error"));
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent, onError, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Handler error" }));
    watcher.stop();
  });

  it("stop() prevents further polling", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();
    watcher.stop();

    await vi.advanceTimersByTimeAsync(5000);

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("start() is idempotent — double start does not create two timers", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();
    watcher.start(); // second call should be no-op

    await vi.advanceTimersByTimeAsync(1000);

    expect(onEvent).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("isRunning() reflects start/stop state", () => {
    const watcher = new PollingWatcher({
      client: makeClient(),
      onEvent: vi.fn(),
      pollIntervalMs: 1000,
    });

    expect(watcher.isRunning()).toBe(false);
    watcher.start();
    expect(watcher.isRunning()).toBe(true);
    watcher.stop();
    expect(watcher.isRunning()).toBe(false);
  });

  it("resetSeen() allows already-seen events to be re-processed", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent, pollIntervalMs: 1000 });
    watcher.start();

    await vi.advanceTimersByTimeAsync(1000);
    expect(onEvent).toHaveBeenCalledTimes(1);

    watcher.resetSeen();
    await vi.advanceTimersByTimeAsync(1000);
    expect(onEvent).toHaveBeenCalledTimes(2);

    watcher.stop();
  });

  it("uses default 5000ms poll interval when not specified", async () => {
    const onEvent = vi.fn().mockResolvedValue(undefined);
    const client = makeClient([makeEvent()]);
    const watcher = new PollingWatcher({ client, onEvent }); // no pollIntervalMs
    watcher.start();

    await vi.advanceTimersByTimeAsync(4999);
    expect(onEvent).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onEvent).toHaveBeenCalledTimes(1);

    watcher.stop();
  });
});
