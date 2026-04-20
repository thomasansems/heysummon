import { HeySummonHttpError } from "@heysummon/consumer-sdk";
import type { CredentialFields } from "../lib/client-factory";
import { buildClient } from "../lib/client-factory";
import { buildError, type ErrorEnvelope } from "../lib/errors";
import { validateSummon, type SummonInput } from "../lib/schemas";

export interface SummonSuccess {
  requestId: string;
  refCode: string | null;
  status: "responded";
  response: string;
  responder: string | null;
  respondedAt: string;
  latencyMs: number;
  messageCount: number;
}

export type SummonResult = SummonSuccess | ErrorEnvelope;

export interface SummonDeps {
  /** Test seam — defaults to global setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Test seam — defaults to Date.now. */
  now?: () => number;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

function classifyHttpError(
  err: HeySummonHttpError,
  requestId: string | null,
  refCode: string | null
): ErrorEnvelope {
  if (err.status >= 400 && err.status < 500) {
    let kind: "http" | "guard_rejected" = "http";
    let message = err.message;
    try {
      const parsed = JSON.parse(err.body) as {
        error?: string;
        reason?: string;
        message?: string;
      };
      const reason = (parsed.reason ?? parsed.error ?? "").toString().toLowerCase();
      if (reason.includes("guard") || reason.includes("content")) {
        kind = "guard_rejected";
      }
      message = parsed.message ?? parsed.error ?? message;
    } catch {
      // body wasn't JSON; fall through with raw message
    }
    return buildError({
      kind,
      message,
      requestId,
      refCode,
      httpStatus: err.status,
      retriable: false,
    });
  }
  return buildError({
    kind: "http",
    message: err.message,
    requestId,
    refCode,
    httpStatus: err.status,
    retriable: err.status >= 500,
  });
}

function classifyUnknownError(
  err: unknown,
  requestId: string | null,
  refCode: string | null
): ErrorEnvelope {
  if (err instanceof HeySummonHttpError) {
    return classifyHttpError(err, requestId, refCode);
  }
  const message = err instanceof Error ? err.message : String(err);
  return buildError({
    kind: "network",
    message,
    requestId,
    refCode,
  });
}

/**
 * Run the Summon operation: submit a help request, poll until the expert
 * responds (or until expiry / timeout / error), and return either a success
 * envelope or a structured error envelope.
 */
export async function runSummon(
  rawInput: Partial<SummonInput>,
  credentials: CredentialFields,
  deps: SummonDeps = {}
): Promise<SummonResult> {
  const validated = validateSummon(rawInput);
  if (!validated.ok) {
    return buildError({
      kind: "validation",
      message: validated.failures.map((f) => `${f.field}: ${f.message}`).join("; "),
      requestId: null,
      refCode: null,
    });
  }
  const input = validated.value;

  const client = buildClient(credentials);
  const sleep = deps.sleep ?? defaultSleep;
  const now = deps.now ?? Date.now;

  const startedAt = now();

  let requestId: string | null = null;
  let refCode: string | null = null;

  let submit;
  try {
    submit = await client.submitRequest({
      question: input.question,
      messages: input.context
        ? [{ role: "user", content: input.context }]
        : undefined,
      expertName: input.expertName,
      requiresApproval: input.requiresApproval,
    });
  } catch (err) {
    return classifyUnknownError(err, null, null);
  }

  if (submit.rejected) {
    return buildError({
      kind: "guard_rejected",
      message: submit.message ?? submit.reason ?? "Request rejected by HeySummon",
      requestId: submit.requestId ?? null,
      refCode: submit.refCode ?? null,
      retriable: false,
    });
  }

  requestId = submit.requestId ?? null;
  refCode = submit.refCode ?? null;

  if (!requestId) {
    return buildError({
      kind: "http",
      message: "HeySummon did not return a requestId",
      requestId: null,
      refCode,
    });
  }

  const deadline = startedAt + input.timeoutMs;
  let messageCount = 0;

  while (true) {
    let status;
    try {
      status = await client.getRequestStatus(requestId);
    } catch (err) {
      return classifyUnknownError(err, requestId, refCode);
    }

    if (status.refCode) {
      refCode = status.refCode;
    }

    if (status.status === "responded") {
      const response =
        status.response ??
        status.lastMessage ??
        "";
      const respondedAt = new Date().toISOString();
      const latencyMs = now() - startedAt;
      // Approximate message count: at least the question + the response.
      messageCount = Math.max(messageCount, 2);
      return {
        requestId,
        refCode,
        status: "responded",
        response,
        responder: status.expert?.name ?? status.expertName ?? null,
        respondedAt,
        latencyMs,
        messageCount,
      };
    }

    if (status.status === "expired" || status.status === "closed") {
      return buildError({
        kind: "expired",
        message: `Request ${status.status}`,
        requestId,
        refCode,
        retriable: false,
      });
    }

    if (now() >= deadline) {
      // Best-effort timeout report; ignore failures.
      try {
        await client.reportTimeout(requestId);
      } catch {
        // swallow — primary error is the timeout
      }
      return buildError({
        kind: "timeout",
        message: `Local timeout after ${input.timeoutMs}ms`,
        requestId,
        refCode,
        retriable: true,
      });
    }

    const remaining = deadline - now();
    const wait = Math.min(input.pollIntervalMs, Math.max(0, remaining));
    await sleep(wait);
  }
}
