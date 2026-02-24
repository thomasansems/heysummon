import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToMercure } from "@/lib/mercure";
import type { TelegramConfig } from "@/lib/adapters/types";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    date: number;
    text?: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Find the channel provider
  const channel = await prisma.channelProvider.findUnique({
    where: { id },
    include: {
      profile: {
        select: { userId: true },
      },
    },
  });

  if (!channel || channel.type !== "telegram" || !channel.isActive) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const config = JSON.parse(channel.config) as TelegramConfig;

  // Verify webhook secret
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!config.webhookSecret || secretHeader !== config.webhookSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  // Parse the Telegram update
  const update: TelegramUpdate = await request.json();
  const message = update.message;

  if (!message?.text || !message.chat) {
    // Not a text message — acknowledge but ignore
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const senderName = [message.from?.first_name, message.from?.last_name]
    .filter(Boolean)
    .join(" ") || message.from?.username || "Unknown";

  // Update heartbeat
  await prisma.channelProvider.update({
    where: { id },
    data: { lastHeartbeat: new Date() },
  });

  // Find the user's first active API key to attach the request to
  const apiKey = await prisma.apiKey.findFirst({
    where: { userId: channel.profile.userId, isActive: true },
    select: { id: true },
  });

  if (!apiKey) {
    return NextResponse.json({ ok: true }); // No key to assign — silently skip
  }

  // Find or create a HelpRequest for this chat + channel
  let helpRequest = await prisma.helpRequest.findFirst({
    where: {
      channelProviderId: id,
      consumerChatId: chatId,
      status: { notIn: ["closed", "expired"] },
    },
  });

  if (!helpRequest) {
    // Create a new help request from this Telegram message
    const refCode = `TG-${Date.now().toString(36).toUpperCase()}`;
    helpRequest = await prisma.helpRequest.create({
      data: {
        refCode,
        apiKeyId: apiKey.id,
        expertId: channel.profile.userId,
        channelProviderId: id,
        consumerChatId: chatId,
        consumerName: senderName,
        status: "pending",
        expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        question: message.text,
      },
    });

    // Publish new request event
    try {
      await publishToMercure(
        `/heysummon/providers/${channel.profile.userId}`,
        {
          type: "new_request",
          requestId: helpRequest.id,
          refCode: helpRequest.refCode,
          channel: "telegram",
          consumerName: senderName,
        }
      );
    } catch { /* non-fatal */ }
  } else {
    // Add message to existing request using the Message model
    const crypto = await import("node:crypto");
    await prisma.message.create({
      data: {
        requestId: helpRequest.id,
        from: "consumer",
        ciphertext: Buffer.from(message.text).toString("base64"),
        iv: "plaintext",
        authTag: "plaintext",
        signature: "plaintext",
        messageId: crypto.randomUUID(),
      },
    });

    // Publish new message event
    try {
      await publishToMercure(
        `/heysummon/requests/${helpRequest.id}`,
        {
          type: "new_message",
          requestId: helpRequest.id,
          from: "consumer",
          channel: "telegram",
        }
      );
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true });
}
