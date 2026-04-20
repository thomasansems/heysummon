export interface SummonInput {
  question: string;
  context?: string;
  expertName?: string;
  requiresApproval?: boolean;
  timeoutMs: number;
  pollIntervalMs: number;
}

export interface GetStatusInput {
  requestId: string;
}

export interface ValidationFailure {
  field: string;
  message: string;
}

export function validateSummon(raw: Partial<SummonInput>): {
  ok: true;
  value: SummonInput;
} | {
  ok: false;
  failures: ValidationFailure[];
} {
  const failures: ValidationFailure[] = [];

  const question = (raw.question ?? "").toString().trim();
  if (!question) {
    failures.push({ field: "question", message: "Question is required." });
  }

  const timeoutMs =
    typeof raw.timeoutMs === "number" && raw.timeoutMs > 0
      ? raw.timeoutMs
      : 900_000;

  const pollIntervalMs =
    typeof raw.pollIntervalMs === "number" && raw.pollIntervalMs > 0
      ? raw.pollIntervalMs
      : 2_000;

  if (pollIntervalMs >= timeoutMs) {
    failures.push({
      field: "pollIntervalMs",
      message: "pollIntervalMs must be smaller than timeoutMs.",
    });
  }

  if (failures.length > 0) {
    return { ok: false, failures };
  }

  return {
    ok: true,
    value: {
      question,
      context: raw.context?.toString().trim() || undefined,
      expertName: raw.expertName?.toString().trim() || undefined,
      requiresApproval: !!raw.requiresApproval,
      timeoutMs,
      pollIntervalMs,
    },
  };
}

export function validateGetStatus(raw: Partial<GetStatusInput>): {
  ok: true;
  value: GetStatusInput;
} | {
  ok: false;
  failures: ValidationFailure[];
} {
  const requestId = (raw.requestId ?? "").toString().trim();
  if (!requestId) {
    return {
      ok: false,
      failures: [{ field: "requestId", message: "requestId is required." }],
    };
  }
  return { ok: true, value: { requestId } };
}
