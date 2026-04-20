export type ErrorKind =
  | "timeout"
  | "expired"
  | "network"
  | "http"
  | "guard_rejected"
  | "validation";

export interface ErrorEnvelope {
  error: {
    kind: ErrorKind;
    message: string;
    requestId: string | null;
    refCode: string | null;
    httpStatus?: number;
    retriable: boolean;
  };
}

const RETRIABLE_KINDS: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  "timeout",
  "network",
]);

export function buildError(opts: {
  kind: ErrorKind;
  message: string;
  requestId?: string | null;
  refCode?: string | null;
  httpStatus?: number;
  retriable?: boolean;
}): ErrorEnvelope {
  const retriable =
    opts.retriable !== undefined
      ? opts.retriable
      : opts.kind === "http" && (opts.httpStatus ?? 0) >= 500
        ? true
        : RETRIABLE_KINDS.has(opts.kind);

  const env: ErrorEnvelope["error"] = {
    kind: opts.kind,
    message: opts.message,
    requestId: opts.requestId ?? null,
    refCode: opts.refCode ?? null,
    retriable,
  };
  if (opts.httpStatus !== undefined) {
    env.httpStatus = opts.httpStatus;
  }
  return { error: env };
}
