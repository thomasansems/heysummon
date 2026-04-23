import { prisma } from "@/lib/prisma";

/**
 * On-read sweep that flips notification-mode help requests
 * (`responseRequired=false`) from `pending` to `expired` once `expiresAt`
 * is in the past. Notifications have no dedicated cron — every read path
 * that lists pending notifications calls this first.
 *
 * Cost is bounded by the `[responseRequired, status, expiresAt]` index on
 * `HelpRequest` and is a no-op when nothing is stale.
 */
export async function sweepExpiredNotifications(): Promise<void> {
  await prisma.helpRequest.updateMany({
    where: {
      responseRequired: false,
      status: "pending",
      expiresAt: { lt: new Date() },
    },
    data: { status: "expired" },
  });
}
