import type { HeySummonClient } from "./client.js";
import type { PendingEvent } from "./types.js";

export interface PollingWatcherOptions {
  client: HeySummonClient;
  /** Interval between polls in ms (default: 5000) */
  pollIntervalMs?: number;
  /** Called for each new event received */
  onEvent: (event: PendingEvent) => Promise<void>;
  /** Called on network/poll errors — must not throw */
  onError?: (err: Error) => void;
}

/**
 * Polls /api/v1/events/pending on an interval and fires onEvent for each result.
 * Replaces the 286-line platform-watcher.sh with a testable TypeScript class.
 *
 * Deduplication: tracks seen requestIds in memory to avoid double-processing.
 */
export class PollingWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private seen = new Set<string>();

  constructor(private readonly opts: PollingWatcherOptions) {}

  start(): void {
    if (this.timer !== null) return; // already running

    const interval = this.opts.pollIntervalMs ?? 5_000;

    this.timer = setInterval(async () => {
      try {
        const { events } = await this.opts.client.getPendingEvents();

        for (const event of events) {
          const eventKey = `${event.requestId}:${event.type}:${event.latestMessageAt ?? ""}`;
          if (this.seen.has(eventKey)) continue;
          this.seen.add(eventKey);

          try {
            await this.opts.onEvent(event);
          } catch (err) {
            this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
          }

          // Ack the event (best-effort, non-blocking)
          if (event.requestId) {
            this.opts.client.ackEvent(event.requestId).catch(() => {});
          }
        }
      } catch (err) {
        this.opts.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }, interval);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.timer !== null;
  }

  /** Reset the deduplication set (useful in tests) */
  resetSeen(): void {
    this.seen.clear();
  }
}
