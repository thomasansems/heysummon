import { HeySummonHttpError } from "@heysummon/consumer-sdk";
import type { CredentialFields } from "../lib/client-factory";
import { buildClient } from "../lib/client-factory";
import { buildError, type ErrorEnvelope } from "../lib/errors";
import { validateGetStatus, type GetStatusInput } from "../lib/schemas";

export interface GetStatusSuccess {
  requestId: string;
  refCode: string | null;
  status: string;
  responder: string | null;
  respondedAt: string | null;
  messageCount: number;
  /**
   * Always null when the credential has E2E enabled (the default) — the
   * per-execution keypair from the original Summon is no longer in memory.
   * See PRD §4.5.
   */
  response: string | null;
}

export type GetStatusResult = GetStatusSuccess | ErrorEnvelope;

export async function runGetStatus(
  rawInput: Partial<GetStatusInput>,
  credentials: CredentialFields
): Promise<GetStatusResult> {
  const validated = validateGetStatus(rawInput);
  if (!validated.ok) {
    return buildError({
      kind: "validation",
      message: validated.failures.map((f) => `${f.field}: ${f.message}`).join("; "),
      requestId: null,
      refCode: null,
    });
  }

  const client = buildClient(credentials);
  let status;
  try {
    status = await client.getRequestStatus(validated.value.requestId);
  } catch (err) {
    if (err instanceof HeySummonHttpError) {
      return buildError({
        kind: "http",
        message: err.message,
        requestId: validated.value.requestId,
        refCode: null,
        httpStatus: err.status,
        retriable: err.status >= 500,
      });
    }
    return buildError({
      kind: "network",
      message: err instanceof Error ? err.message : String(err),
      requestId: validated.value.requestId,
      refCode: null,
    });
  }

  const e2eOn = credentials.e2eEnabled !== false;

  return {
    requestId: status.requestId ?? validated.value.requestId,
    refCode: status.refCode ?? null,
    status: status.status,
    responder: status.expert?.name ?? status.expertName ?? null,
    respondedAt: status.status === "responded" ? new Date().toISOString() : null,
    messageCount: status.status === "responded" ? 2 : 1,
    response: e2eOn ? null : (status.response ?? status.lastMessage ?? null),
  };
}
