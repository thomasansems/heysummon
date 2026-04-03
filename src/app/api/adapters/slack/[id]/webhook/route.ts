import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMessage, verifySlackSignature } from "@/lib/adapters/slack";
import type { SlackConfig } from "@/lib/adapters/types";

/** Max length for an expert reply via Slack */
const MAX_REPLY_LENGTH = 10_000;

const slackEventSchema = z.object({
  type: z.string(),
  token: z.string().optional(),
  team_id: z.string().optional(),
  event: z
    .object({
      type: z.string(),
      channel: z.string().optional(),
      user: z.string().optional(),
      text: z.string().max(40_000).optional(),
      ts: z.string().optional(),
      bot_id: z.string().optional(),
      subtype: z.string().optional(),
    })
    .optional(),
  challenge: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Read the raw body for signature verification
  const rawBody = await request.text();

  // Find the expert channel
  const channel = await prisma.expertChannel.findUnique({
    where: { id },
    include: {
      profile: {
        select: { userId: true },
      },
    },
  });

  if (!channel || channel.type !== "slack" || !channel.isActive) {
    return NextResponse.json(
      { error: "Channel not found" },
      { status: 404 },
    );
  }

  const config = JSON.parse(channel.config) as SlackConfig;

  // Verify Slack request signature
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (
    !config.signingSecret ||
    !timestamp ||
    !signature ||
    !verifySlackSignature(config.signingSecret, timestamp, rawBody, signature)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // Parse the event
  let parsed: z.infer<typeof slackEventSchema>;
  try {
    const raw = JSON.parse(rawBody);
    console.log("[slack-webhook] Raw event:", JSON.stringify(raw, null, 2));
    const result = slackEventSchema.safeParse(raw);
    if (!result.success) {
      console.log("[slack-webhook] Zod parse failed:", result.error.format());
      return NextResponse.json({ ok: true });
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle Slack URL verification challenge
  if (parsed.type === "url_verification" && parsed.challenge) {
    return NextResponse.json({ challenge: parsed.challenge });
  }

  // Only process event_callback type
  if (parsed.type !== "event_callback") {
    console.log("[slack-webhook] Ignoring non-event_callback type:", parsed.type);
    return NextResponse.json({ ok: true });
  }

  const event = parsed.event;
  if (!event || event.type !== "message" || !event.text || !event.channel) {
    console.log("[slack-webhook] Dropping: missing event fields", {
      hasEvent: !!event,
      type: event?.type,
      hasText: !!event?.text,
      hasChannel: !!event?.channel,
      subtype: event?.subtype,
    });
    return NextResponse.json({ ok: true });
  }

  // Ignore bot messages (prevent loops)
  if (event.bot_id || event.subtype === "bot_message") {
    console.log("[slack-webhook] Ignoring bot message");
    return NextResponse.json({ ok: true });
  }

  // Ignore messages from other channels
  if (event.channel !== config.channelId) {
    console.log("[slack-webhook] Channel mismatch:", { eventChannel: event.channel, configChannel: config.channelId });
    return NextResponse.json({ ok: true });
  }

  const text = event.text.trim();

  // Update heartbeat
  await prisma.expertChannel.update({
    where: { id },
    data: { lastHeartbeat: new Date() },
  });

  console.log("[slack-webhook] Processing message text:", JSON.stringify(text));

  // -- reply HS-XXXX answer -- Expert replying (no slash — Slack intercepts / as commands)
  // Strip surrounding backticks/code formatting that Slack adds when users copy from code blocks
  const cleanText = text.replace(/^`+|`+$/g, "").trim();
  const replyMatch = cleanText.match(/^reply\s+(HS-[A-Za-z0-9]+)\s+([\s\S]+)/i);
  console.log("[slack-webhook] Reply match:", replyMatch ? { refCode: replyMatch[1], answer: replyMatch[2].slice(0, 50) } : null);
  if (replyMatch) {
    const refCode = replyMatch[1].toUpperCase();
    const answer = replyMatch[2].trim();

    if (answer.length > MAX_REPLY_LENGTH) {
      await sendMessage(
        config.botToken,
        config.channelId,
        `Reply is too long (${answer.length} chars). Maximum is ${MAX_REPLY_LENGTH}.`,
      );
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
        config.channelId,
        `Request \`${refCode}\` not found or already closed.`,
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
    // Slack replies are plaintext -- store with a "plaintext:" prefix convention
    // so consumers can distinguish from E2E encrypted messages.
    const plainB64 = Buffer.from(answer, "utf-8").toString("base64");
    await prisma.message.create({
      data: {
        requestId: helpRequest.id,
        from: "expert",
        ciphertext: `plaintext:${plainB64}`,
        iv: "plaintext",
        authTag: "plaintext",
        signature: "plaintext",
        messageId: `slack-${randomUUID()}`,
      },
    });

    await sendMessage(
      config.botToken,
      config.channelId,
      `Reply sent for \`${refCode}\`.`,
    );

    return NextResponse.json({ ok: true });
  }

  // Unrecognised message -- ignore (don't spam the channel with help text)
  return NextResponse.json({ ok: true });
}
