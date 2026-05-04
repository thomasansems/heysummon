/**
 * Error thrown when required environment variables are missing or invalid
 * before any network call is attempted.
 */
export class SummonConfigError extends Error {
  constructor(
    message: string,
    public readonly missingKeys: readonly string[] = []
  ) {
    super(message);
    this.name = "SummonConfigError";
  }
}

/**
 * Error thrown when the blocking poll exceeds the configured timeout
 * without reaching a terminal status. The caller has enough context
 * to reopen or re-ask via the HeySummon dashboard.
 */
export class SummonTimeoutError extends Error {
  constructor(
    message: string,
    public readonly requestId: string,
    public readonly elapsedMs: number,
    public readonly lastKnownStatus: string
  ) {
    super(message);
    this.name = "SummonTimeoutError";
  }
}

/**
 * Error thrown when a request finishes in a non-success terminal state
 * (cancelled, expired, or rejected by the server up front because no
 * expert is available).
 */
export class SummonRejectedError extends Error {
  constructor(
    message: string,
    public readonly requestId: string | undefined,
    public readonly status: string,
    public readonly reason?: string
  ) {
    super(message);
    this.name = "SummonRejectedError";
  }
}
