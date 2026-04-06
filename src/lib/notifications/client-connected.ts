import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/adapters/telegram";
import { sendMessage as sendSlackMessage } from "@/lib/adapters/slack";
import { sendNotification } from "@/lib/adapters/openclaw";
import type { TelegramConfig, SlackConfig, OpenClawConfig } from "@/lib/adapters/types";

/**
 * Send a "client connected" notification to all active channels for the expert
 * linked to the given API key record.
 *
 * Fire-and-forget — catches all errors internally, never throws.
 */
export async function sendClientConnectedNotification(keyRecord: {
  name: string | null;
  expertId: string | null;
  userId: string;
}): Promise<void> {
  try {
    const expertProfiles = await prisma.userProfile.findMany({
      where: keyRecord.expertId
        ? { id: keyRecord.expertId }
        : { userId: keyRecord.userId },
      select: { id: true },
    });

    if (expertProfiles.length === 0) return;

    const profileIds = expertProfiles.map((p) => p.id);
    const clientName = keyRecord.name || "Unknown client";
    const message = `Client '${clientName}' is now connected and ready to summon you.`;

    const channels = await prisma.expertChannel.findMany({
      where: {
        profileId: { in: profileIds },
        isActive: true,
        status: "connected",
      },
    });

    for (const channel of channels) {
      try {
        const cfg = JSON.parse(channel.config);

        switch (channel.type) {
          case "telegram": {
            const tgCfg = cfg as TelegramConfig;
            if (!tgCfg.expertChatId || !tgCfg.botToken) break;
            await sendMessage(tgCfg.botToken, tgCfg.expertChatId, message);
            break;
          }
          case "slack": {
            const slackCfg = cfg as SlackConfig;
            if (!slackCfg.channelId || !slackCfg.botToken) break;
            await sendSlackMessage(slackCfg.botToken, slackCfg.channelId, message);
            break;
          }
          case "openclaw": {
            const ocCfg = cfg as OpenClawConfig & { webhookSecret?: string };
            if (!ocCfg.webhookUrl || !ocCfg.apiKey) break;
            await sendNotification(
              ocCfg.webhookUrl,
              ocCfg.apiKey,
              ocCfg.webhookSecret ?? "",
              { type: "client_connected", message },
            );
            break;
          }
        }
      } catch (err) {
        console.error(`[client-connected] ${channel.type} notify failed:`, err);
      }
    }
  } catch (err) {
    console.error("[client-connected] notification failed:", err);
  }
}
