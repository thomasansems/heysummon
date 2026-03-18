import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/adapters/telegram";
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

  // Verify webhook secret token (Telegram sends this header)
  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!config.webhookSecret || secretHeader !== config.webhookSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  // Parse the Telegram update
  const update: TelegramUpdate = await request.json();
  const message = update.message;

  if (!message?.text || !message.chat) {
    return NextResponse.json({ ok: true }); // Not a text message — ignore
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // Update heartbeat
  await prisma.channelProvider.update({
    where: { id },
    data: { lastHeartbeat: new Date() },
  });

  // ── /start ── Provider registering themselves with the bot
  if (text === "/start" || text.startsWith("/start ")) {
    // Store providerChatId so we can push notifications to them
    const newConfig: TelegramConfig = { ...config, providerChatId: chatId };
    await prisma.channelProvider.update({
      where: { id },
      data: {
        config: JSON.stringify(newConfig),
        status: "connected",
      },
    });

    await sendMessage(
      config.botToken,
      chatId,
      `✅ *HeySummon connected!*\n\nYou'll receive new help requests here. Reply with:\n\`/reply HS-XXXX your answer\`\n\nOr view all open requests in your dashboard.`
    );

    return NextResponse.json({ ok: true });
  }

  // ── /reply HS-XXXX answer ── Provider replying to a help request
  const replyMatch = text.match(/^\/reply\s+(HS-[A-Za-z0-9]+)\s+([\s\S]+)/i);
  if (replyMatch) {
    const refCode = replyMatch[1].toUpperCase();
    const answer = replyMatch[2].trim();

    // Validate: must come from the registered providerChatId
    if (!config.providerChatId) {
      await sendMessage(config.botToken, chatId, `❌ Bot not set up yet. Send /start first.`);
      return NextResponse.json({ ok: true });
    }
    if (chatId !== config.providerChatId) {
      // Someone else — reject silently (don't leak info)
      return NextResponse.json({ ok: true });
    }

    // Find the help request
    const helpRequest = await prisma.helpRequest.findFirst({
      where: {
        refCode,
        expertId: channel.profile.userId,
        status: { notIn: ["closed", "expired"] },
      },
    });

    if (!helpRequest) {
      await sendMessage(
        config.botToken,
        chatId,
        `❌ Request \`${refCode}\` not found or already closed.`
      );
      return NextResponse.json({ ok: true });
    }

    // Store the response and close the request
    await prisma.helpRequest.update({
      where: { id: helpRequest.id },
      data: {
        response: answer,
        status: "closed",
        respondedAt: new Date(),
      },
    });

    await sendMessage(
      config.botToken,
      chatId,
      `✅ Reply sent for \`${refCode}\`.`
    );

    return NextResponse.json({ ok: true });
  }

  // ── Any other message from the provider ── Show help
  if (config.providerChatId && chatId === config.providerChatId) {
    await sendMessage(
      config.botToken,
      chatId,
      `ℹ️ To reply to a request, use:\n\`/reply HS-XXXX your answer\`\n\nCheck your dashboard for open requests.`
    );
    return NextResponse.json({ ok: true });
  }

  // Unrecognised sender — ignore
  return NextResponse.json({ ok: true });
}
