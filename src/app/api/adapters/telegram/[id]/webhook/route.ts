import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/adapters/telegram";
import type { TelegramConfig } from "@/lib/adapters/types";

/** Max length for a provider reply via Telegram */
const MAX_REPLY_LENGTH = 10_000;

const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      username: z.string().optional(),
    }).optional(),
    chat: z.object({
      id: z.number(),
      type: z.string(),
    }),
    date: z.number(),
    text: z.string().max(10_000).optional(),
  }).optional(),
});

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

  // Parse and validate the Telegram update
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = telegramUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: true }); // Silently reject malformed payloads
  }
  const update = parsed.data;
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

  // ── /start <token> ── Provider registering themselves with the bot
  if (text === "/start" || text.startsWith("/start ")) {
    // Require setup token to prevent unauthorized chat binding
    const token = text.split(/\s+/)[1]?.trim();
    if (!config.setupToken || !token || token !== config.setupToken) {
      await sendMessage(
        config.botToken,
        chatId,
        "Please use the setup link from your HeySummon dashboard to connect this bot."
      );
      return NextResponse.json({ ok: true });
    }

    // Store providerChatId and clear the one-time setup token
    const newConfig: TelegramConfig = {
      ...config,
      providerChatId: chatId,
      setupToken: undefined,
    };
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
      `*HeySummon connected!*\n\nYou'll receive new help requests here. Reply with:\n\`/reply HS-XXXX your answer\`\n\nOr view all open requests in your dashboard.`
    );

    return NextResponse.json({ ok: true });
  }

  // ── /reply HS-XXXX answer ── Provider replying to a help request
  const replyMatch = text.match(/^\/reply\s+(HS-[A-Za-z0-9]+)\s+([\s\S]+)/i);
  if (replyMatch) {
    const refCode = replyMatch[1].toUpperCase();
    const answer = replyMatch[2].trim();

    if (answer.length > MAX_REPLY_LENGTH) {
      await sendMessage(
        config.botToken,
        chatId,
        `Reply is too long (${answer.length} chars). Maximum is ${MAX_REPLY_LENGTH}.`
      );
      return NextResponse.json({ ok: true });
    }

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

    const now = new Date();

    // Transition to "responded" and store plaintext in legacy field
    await prisma.helpRequest.update({
      where: { id: helpRequest.id },
      data: {
        response: answer,
        status: "responded",
        respondedAt: now,
      },
    });

    // Create a Message record so consumer polling (events/pending) detects it.
    // Telegram replies are plaintext — store with a "plaintext:" prefix convention
    // so consumers can distinguish from E2E encrypted messages.
    const plainB64 = Buffer.from(answer, "utf-8").toString("base64");
    await prisma.message.create({
      data: {
        requestId: helpRequest.id,
        from: "provider",
        ciphertext: `plaintext:${plainB64}`,
        iv: "plaintext",
        authTag: "plaintext",
        signature: "plaintext",
        messageId: `tg-${randomUUID()}`,
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
