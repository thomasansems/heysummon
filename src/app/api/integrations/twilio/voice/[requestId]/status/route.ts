export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/adapters/telegram";
import type { TelegramConfig } from "@/lib/adapters/types";

/**
 * POST /api/integrations/twilio/voice/:requestId/status
 *
 * Twilio calls this URL whenever the call status changes.
 * If the call was not answered or failed, triggers fallback to chat channel.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const formData = await request.formData();
  const callStatus = formData.get("CallStatus") as string | null;
  const callSid = formData.get("CallSid") as string | null;

  if (!callStatus) {
    return NextResponse.json({ ok: true });
  }

  // Map Twilio status to our status
  const statusMap: Record<string, string> = {
    queued: "initiated",
    ringing: "ringing",
    "in-progress": "answered",
    completed: "completed",
    busy: "busy",
    "no-answer": "no-answer",
    failed: "failed",
    canceled: "failed",
  };

  const mappedStatus = statusMap[callStatus] || callStatus;

  // Update the call status
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: { phoneCallStatus: mappedStatus },
  });

  // If the call ended without a response, trigger chat fallback
  const fallbackStatuses = ["no-answer", "busy", "failed"];
  if (fallbackStatuses.includes(mappedStatus)) {
    await triggerChatFallback(requestId);
  }

  // If completed and we already have a response, no action needed
  // (the gather endpoint already handled the response)

  return NextResponse.json({ ok: true });
}

/**
 * When a phone call fails/goes unanswered, fall back to the configured chat channel.
 */
async function triggerChatFallback(requestId: string) {
  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      refCode: true,
      questionPreview: true,
      question: true,
      status: true,
      phoneCallResponse: true,
      expertId: true,
    },
  });

  if (!helpRequest || helpRequest.status !== "pending") return;
  // If there's already a phone response, don't fall back
  if (helpRequest.phoneCallResponse) return;

  // Find the provider's Telegram channel (or other chat channel)
  const telegramChannel = await prisma.channelProvider.findFirst({
    where: {
      profile: { userId: helpRequest.expertId },
      type: "telegram",
      isActive: true,
      status: "connected",
    },
  });

  if (!telegramChannel) return;

  const cfg = JSON.parse(telegramChannel.config) as TelegramConfig;
  if (!cfg.providerChatId || !cfg.botToken) return;

  const questionText = helpRequest.questionPreview || "A help request is waiting for you.";
  const msg = `📞 *Phone call was not answered* — falling back to chat.\n\n🦞 *Help request* \`${helpRequest.refCode}\`\n\n*Question:* ${questionText.slice(0, 500)}${questionText.length > 500 ? "…" : ""}\n\nReply with:\n\`/reply ${helpRequest.refCode} your answer\``;

  try {
    await sendMessage(cfg.botToken, cfg.providerChatId, msg);
  } catch (err) {
    console.error("[twilio-voice] Chat fallback notification failed:", err);
  }
}
