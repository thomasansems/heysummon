import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendMessage, updateMessage, verifySlackSignature } from "@/lib/adapters/slack";
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

/** Schema for Slack interactive payload (block_actions) */
const slackInteractiveSchema = z.object({
  type: z.literal("block_actions"),
  user: z.object({ id: z.string(), username: z.string().optional() }),
  actions: z.array(
    z.object({
      action_id: z.string(),
      value: z.string().optional(),
    }),
  ),
  channel: z.object({ id: z.string() }).optional(),
  message: z
    .object({
      ts: z.string(),
      text: z.string().optional(),
    })
    .optional(),
  container: z
    .object({
      channel_id: z.string().optional(),
      message_ts: z.string().optional(),
    })
    .optional(),
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

  // ── Interactive payload (block_actions) ──
  // Slack sends interactive payloads as form-encoded with a "payload" field
  const formPayload = tryParseFormPayload(rawBody);
  if (formPayload) {
    const result = slackInteractiveSchema.safeParse(formPayload);
    if (!result.success) {
      console.log("[slack-webhook] Interactive payload parse failed:", result.error.format());
      return NextResponse.json({ ok: true });
    }

    const interactive = result.data;
    if (interactive.type === "block_actions") {
      return handleBlockActions(interactive, channel, config);
    }

    return NextResponse.json({ ok: true });
  }

  // ── Event API payload ──
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

  // -- reply HS-XXXX answer -- Expert replying (no slash -- Slack intercepts / as commands)
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

/**
 * Try to parse a Slack interactive payload from form-encoded body.
 * Slack sends interactive payloads as: payload=<url-encoded-json>
 */
function tryParseFormPayload(rawBody: string): unknown | null {
  try {
    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get("payload");
    if (!payloadStr) return null;
    return JSON.parse(payloadStr);
  } catch {
    return null;
  }
}

/** Handle Slack Block Kit button actions (approve/deny) */
async function handleBlockActions(
  interactive: z.infer<typeof slackInteractiveSchema>,
  channel: { id: string; profile: { userId: string } },
  config: SlackConfig,
): Promise<NextResponse> {
  const action = interactive.actions[0];
  if (!action) return NextResponse.json({ ok: true });

  const actionId = action.action_id;
  const requestId = action.value;

  if (!requestId || (actionId !== "approve_request" && actionId !== "deny_request")) {
    return NextResponse.json({ ok: true });
  }

  const decision = actionId === "approve_request" ? "approved" : "denied";

  // Find the help request -- must belong to this expert
  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      id: requestId,
      expertId: channel.profile.userId,
      requiresApproval: true,
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ ok: true });
  }

  // Prevent double-decision
  if (helpRequest.approvalDecision) {
    // Update the message to show the existing decision
    const messageTs = interactive.message?.ts ?? interactive.container?.message_ts;
    const channelId = interactive.channel?.id ?? interactive.container?.channel_id;
    if (messageTs && channelId) {
      await updateMessage(
        config.botToken,
        channelId,
        messageTs,
        `Request \`${helpRequest.refCode}\` -- Already ${helpRequest.approvalDecision}`,
      ).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  // Reject if expired/cancelled
  if (helpRequest.status === "expired" || helpRequest.status === "cancelled") {
    const messageTs = interactive.message?.ts ?? interactive.container?.message_ts;
    const channelId = interactive.channel?.id ?? interactive.container?.channel_id;
    if (messageTs && channelId) {
      await updateMessage(
        config.botToken,
        channelId,
        messageTs,
        `Request \`${helpRequest.refCode}\` -- Request is ${helpRequest.status}`,
      ).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  const now = new Date();

  // Apply the decision
  await prisma.helpRequest.update({
    where: { id: helpRequest.id },
    data: {
      approvalDecision: decision,
      status: "responded",
      respondedAt: now,
    },
  });

  // Create a Message record so consumer polling detects it
  await prisma.message.create({
    data: {
      requestId: helpRequest.id,
      from: "expert",
      ciphertext: decision,
      iv: "",
      authTag: "",
      signature: "",
      messageId: `approval-${helpRequest.id}-${Date.now()}`,
    },
  });

  // Update the original message to show decision and remove buttons
  const label = decision === "approved" ? "Approved" : "Denied";
  const messageTs = interactive.message?.ts ?? interactive.container?.message_ts;
  const channelId = interactive.channel?.id ?? interactive.container?.channel_id;
  if (messageTs && channelId) {
    await updateMessage(
      config.botToken,
      channelId,
      messageTs,
      `Request \`${helpRequest.refCode}\` -- *Decision:* ${label}`,
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
