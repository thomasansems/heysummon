import { HeySummonClient } from "@heysummon/consumer-sdk";
import type {
  HeySummonClientOptions,
  RequestStatusResponse,
  SubmitRequestResult,
} from "@heysummon/consumer-sdk";
import { loadConfig, type SummonConfig } from "./config.js";
import {
  SummonRejectedError,
  SummonTimeoutError,
} from "./errors.js";

/** Default exponential backoff, capped at 15s between polls. */
export const DEFAULT_POLL_INTERVALS_MS: readonly number[] = [2000, 4000, 8000, 15000];

/** Statuses indicating the request has reached an end state (no more polling needed). */
const TERMINAL_STATUSES = new Set([
  "closed",
  "responded",
  "timed_out",
  "cancelled",
  "expired",
]);

/** Statuses indicating a non-success terminal state. */
const REJECTED_STATUSES = new Set(["cancelled", "expired", "timed_out"]);

export interface SummonOptions {
  /** The question or request for the human expert. Required. */
  question: string;
  /** Optional conversation context to attach to the request. */
  messages?: Array<{ role: string; content: string }>;
  /** Target a specific named expert registered for this API key. */
  expertName?: string;
  /** Render Approve / Deny buttons instead of a free-text reply. */
  requiresApproval?: boolean;
}

export interface SummonRuntimeOptions {
  /** Inject a preconfigured client. Overrides `config` + `clientOptions`. */
  client?: HeySummonClient;
  /** Override loaded config (defaults to `loadConfig()` from env). */
  config?: SummonConfig;
  /** Extra `HeySummonClient` options (only used when `client` is not provided). */
  clientOptions?: Partial<HeySummonClientOptions>;
  /** Poll intervals in ms. Loops forever on the last value. Defaults to 2s, 4s, 8s, 15s. */
  pollIntervals?: readonly number[];
  /** Inject a sleep function (defaults to setTimeout-based). Tests override for speed. */
  sleep?: (ms: number) => Promise<void>;
  /** Inject a clock (defaults to `Date.now`). Tests override to simulate elapsed time. */
  now?: () => number;
}

export interface SummonResult {
  /** The expert's reply (free-text answer, or "approved" / "denied" for approval requests). */
  response: string;
  /** Opaque request id for correlation with the HeySummon dashboard. */
  requestId: string;
  /** Human-readable reference code (e.g. `HS-AB12`), when the server provides one. */
  refCode?: string;
  /** Final terminal status reported by the server. */
  status: string;
  /** How long the summon blocked for, in milliseconds. */
  elapsedMs: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function buildClient(
  config: SummonConfig,
  clientOptions?: Partial<HeySummonClientOptions>
): HeySummonClient {
  return new HeySummonClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    ...clientOptions,
  });
}

function extractResponse(status: RequestStatusResponse): string {
  // Prefer the explicit `response` field (approval replies live here too).
  if (typeof status.response === "string" && status.response.length > 0) {
    return status.response;
  }
  if (typeof status.lastMessage === "string" && status.lastMessage.length > 0) {
    return status.lastMessage;
  }
  if (typeof status.approvalDecision === "string" && status.approvalDecision.length > 0) {
    return status.approvalDecision;
  }
  return "";
}

/**
 * Fetch the latest expert plaintext for a request via the messages endpoint.
 * The SDK auto-decrypts using the keystore populated by submitRequest().
 * Returns null when the server has no expert message yet (race with status flip)
 * or when the decrypt path fails; the caller should keep polling in that case.
 */
async function fetchLatestExpertReply(
  client: HeySummonClient,
  requestId: string
): Promise<string | null> {
  try {
    const { messages } = await client.getMessages(requestId);
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const m = messages[i];
      if (
        m &&
        m.from === "expert" &&
        typeof m.plaintext === "string" &&
        m.plaintext.length > 0
      ) {
        return m.plaintext;
      }
    }
    return null;
  } catch {
    return null;
  }
}

function intervalFor(pollIntervals: readonly number[], attempt: number): number {
  if (pollIntervals.length === 0) return 1000;
  return pollIntervals[Math.min(attempt, pollIntervals.length - 1)] as number;
}

/**
 * Submit a help request to a human expert via HeySummon and block until the
 * expert responds, the request is cancelled, or the configured timeout elapses.
 *
 * Environment:
 *   HEYSUMMON_API_KEY  required consumer API key
 *   HEYSUMMON_URL      required platform base URL
 *   HEYSUMMON_TIMEOUT  optional poll timeout in seconds (default 900)
 *
 * @throws {SummonConfigError}    when required env vars are missing / invalid
 * @throws {SummonRejectedError}  when the server rejects the request or the
 *                                status resolves to cancelled / expired
 * @throws {SummonTimeoutError}   when the timeout elapses before a terminal
 *                                status is reached (server is notified via
 *                                `reportTimeout` before this is raised)
 */
export async function summon(
  options: SummonOptions,
  runtime: SummonRuntimeOptions = {}
): Promise<SummonResult> {
  if (!options || typeof options.question !== "string" || options.question.trim() === "") {
    throw new TypeError("summon: `question` is required and must be a non-empty string");
  }

  const config = runtime.config ?? loadConfig();
  const client = runtime.client ?? buildClient(config, runtime.clientOptions);
  const pollIntervals = runtime.pollIntervals ?? DEFAULT_POLL_INTERVALS_MS;
  const sleep = runtime.sleep ?? defaultSleep;
  const now = runtime.now ?? Date.now;

  const startedAt = now();

  const submitResult: SubmitRequestResult = await client.submitRequest({
    question: options.question,
    messages: options.messages,
    expertName: options.expertName,
    requiresApproval: options.requiresApproval,
  });

  // Server rejected up front (no expert available, key disabled, etc.)
  if (submitResult.rejected) {
    throw new SummonRejectedError(
      submitResult.message ?? submitResult.reason ?? "Help request rejected by the server",
      submitResult.requestId,
      submitResult.status ?? "rejected",
      submitResult.reason
    );
  }

  const requestId = submitResult.requestId;
  if (!requestId) {
    throw new SummonRejectedError(
      "Help request did not return a requestId",
      undefined,
      submitResult.status ?? "unknown",
      submitResult.reason
    );
  }

  let attempt = 0;
  let lastStatus: string = submitResult.status ?? "pending";

  while (true) {
    const elapsed = now() - startedAt;
    if (elapsed >= config.timeoutMs) {
      // Notify the server so it can stop holding the request open.
      try {
        await client.reportTimeout(requestId);
      } catch {
        // Reporting failure is non-fatal; surface the original timeout instead.
      }
      throw new SummonTimeoutError(
        `Summon timed out after ${elapsed}ms waiting for expert response (requestId=${requestId}, lastKnownStatus=${lastStatus})`,
        requestId,
        elapsed,
        lastStatus
      );
    }

    const delay = Math.min(intervalFor(pollIntervals, attempt), config.timeoutMs - elapsed);
    if (delay > 0) await sleep(delay);
    attempt += 1;

    const status = await client.getRequestStatus(requestId);
    lastStatus = status.status ?? lastStatus;

    if (!TERMINAL_STATUSES.has(lastStatus)) continue;

    if (REJECTED_STATUSES.has(lastStatus)) {
      throw new SummonRejectedError(
        `Summon request ended with status "${lastStatus}" before an expert replied`,
        requestId,
        lastStatus
      );
    }

    // Success terminal. Prefer the explicit `response` field on the status
    // payload (legacy plaintext replies and approval decisions land there).
    let response = extractResponse(status);

    // In the default E2E flow the dashboard writes the expert reply to the
    // encrypted Message table and flips status to `responded` without ever
    // populating `HelpRequest.response`. Fall back to the messages endpoint
    // so we return real content instead of an empty string.
    if (response === "") {
      const expertReply = await fetchLatestExpertReply(client, requestId);
      if (expertReply !== null) {
        response = expertReply;
      } else {
        // Status flipped to terminal but the expert message row is not yet
        // visible (or not yet decryptable). Keep polling until we see it
        // or the outer timeout fires -- never resume the agent on "".
        continue;
      }
    }

    return {
      response,
      requestId,
      refCode: status.refCode ?? submitResult.refCode ?? undefined,
      status: lastStatus,
      elapsedMs: now() - startedAt,
    };
  }
}
