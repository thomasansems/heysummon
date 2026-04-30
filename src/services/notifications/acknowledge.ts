import { prisma } from "@/lib/prisma";

export type AcknowledgeSource =
  | "api"
  | "dashboard"
  | "telegram"
  | "slack"
  | "discord"
  | "openclaw";

export type AcknowledgeResult =
  | {
      ok: true;
      status: "acknowledged";
      acknowledgedAt: Date;
      alreadyAcknowledged: boolean;
    }
  | {
      ok: false;
      code: "NOT_FOUND" | "NOT_APPLICABLE";
      message: string;
    };

interface AcknowledgeParams {
  requestId: string;
  expertUserId: string;
  source: AcknowledgeSource;
}

/**
 * Acknowledge a notification-mode help request.
 *
 * Shared by:
 *   - POST /api/v1/acknowledge/:requestId
 *   - Dashboard ack button (session-auth wrapper)
 *   - Telegram / Slack / OpenClaw adapter webhooks
 *
 * Rules:
 *   - NOT_FOUND if the request does not exist or is not owned by the caller.
 *   - NOT_APPLICABLE (409) if the request is not notification-mode
 *     (responseRequired !== false) — use /close instead.
 *   - Idempotent: re-acking an already-acknowledged request returns the
 *     original timestamp with alreadyAcknowledged=true.
 */
export async function acknowledgeNotification({
  requestId,
  expertUserId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  source,
}: AcknowledgeParams): Promise<AcknowledgeResult> {
  const helpRequest = await prisma.helpRequest.findFirst({
    where: { id: requestId, expertId: expertUserId },
    select: {
      id: true,
      status: true,
      responseRequired: true,
      acknowledgedAt: true,
    },
  });

  if (!helpRequest) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Request not found",
    };
  }

  if (helpRequest.responseRequired !== false) {
    return {
      ok: false,
      code: "NOT_APPLICABLE",
      message:
        "This request expects a reply; use /close to end the conversation",
    };
  }

  if (helpRequest.status === "acknowledged" && helpRequest.acknowledgedAt) {
    return {
      ok: true,
      status: "acknowledged",
      acknowledgedAt: helpRequest.acknowledgedAt,
      alreadyAcknowledged: true,
    };
  }

  const acknowledgedAt = new Date();

  await prisma.helpRequest.update({
    where: { id: requestId },
    data: {
      status: "acknowledged",
      acknowledgedAt,
    },
  });

  return {
    ok: true,
    status: "acknowledged",
    acknowledgedAt,
    alreadyAcknowledged: false,
  };
}
