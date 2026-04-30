import { NextRequest, NextResponse } from "next/server";
import { createPublicKey, verify, type KeyObject } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { DiscordConfig } from "@/lib/adapters/types";
import { acknowledgeNotification } from "@/services/notifications/acknowledge";

const MAX_TIMESTAMP_SKEW_SECONDS = 300;

/** Discord modal text input cap (paragraph style). */
const MODAL_ANSWER_MAX_LENGTH = 4000;

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const discordInteractionSchema = z.object({
  type: z.number().int(),
  id: z.string().optional(),
  application_id: z.string().optional(),
  token: z.string().optional(),
  data: z.unknown().optional(),
});

type DiscordInteraction = z.infer<typeof discordInteractionSchema>;

const messageComponentDataSchema = z.object({
  custom_id: z.string().min(1).max(200),
  component_type: z.number().int().optional(),
});

const InteractionType = {
  PING: 1,
  MESSAGE_COMPONENT: 3,
  MODAL_SUBMIT: 5,
} as const;

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

const TextInputStyle = {
  SHORT: 1,
  PARAGRAPH: 2,
} as const;

const EPHEMERAL_FLAG = 1 << 6;

type ChannelContext = {
  id: string;
  profile: { userId: string };
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const rawBody = await request.text();

  const channel = await prisma.expertChannel.findUnique({
    where: { id },
    include: { profile: { select: { userId: true } } },
  });

  if (!channel || channel.type !== "discord" || !channel.isActive) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  let config: DiscordConfig;
  try {
    config = JSON.parse(channel.config) as DiscordConfig;
  } catch {
    return NextResponse.json({ error: "Invalid channel config" }, { status: 500 });
  }

  const signature = request.headers.get("x-signature-ed25519") ?? "";
  const timestamp = request.headers.get("x-signature-timestamp") ?? "";

  if (!config.publicKey || !signature || !timestamp) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const timestampSeconds = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (!verifyDiscordSignature(config.publicKey, timestamp, rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let interaction: DiscordInteraction;
  try {
    const parsed = discordInteractionSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    interaction = parsed.data;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.expertChannel.update({
    where: { id },
    data: { lastHeartbeat: new Date() },
  });

  switch (interaction.type) {
    case InteractionType.PING:
      return NextResponse.json({ type: InteractionResponseType.PONG });

    case InteractionType.MESSAGE_COMPONENT:
      return handleMessageComponent(interaction, channel);

    case InteractionType.MODAL_SUBMIT:
      // HEY-455-E will replace this with refCode + answer parsing and decryption.
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: "Reply received. Processing...",
          flags: EPHEMERAL_FLAG,
        },
      });

    default:
      return NextResponse.json({ ok: true });
  }
}

/**
 * Route a Discord MESSAGE_COMPONENT interaction to the matching handler.
 *
 * `custom_id` follows the convention `<action>:<requestId>`, mirroring the
 * Slack `action_id` / `value` split. Unknown actions or malformed ids fall
 * back to a deferred update so Discord doesn't surface an error to the user.
 */
async function handleMessageComponent(
  interaction: DiscordInteraction,
  channel: ChannelContext,
): Promise<NextResponse> {
  const dataParsed = messageComponentDataSchema.safeParse(interaction.data);
  if (!dataParsed.success) {
    return deferredUpdate();
  }

  const customId = dataParsed.data.custom_id;
  const sepIdx = customId.indexOf(":");
  if (sepIdx <= 0 || sepIdx === customId.length - 1) {
    return deferredUpdate();
  }
  const action = customId.slice(0, sepIdx);
  const requestId = customId.slice(sepIdx + 1);
  const expertUserId = channel.profile.userId;

  if (action === "approve_request" || action === "deny_request") {
    return handleApprovalDecision(action, requestId, expertUserId);
  }
  if (action === "ack_notification") {
    return handleAckNotification(requestId, expertUserId);
  }
  if (action === "reply_open_modal") {
    return handleReplyOpenModal(requestId, expertUserId);
  }

  return deferredUpdate();
}

/**
 * Apply an approve / deny decision to a help request and edit the original
 * Discord message in-place via interaction response type 7 (UPDATE_MESSAGE).
 *
 * Idempotent: a second click on a decided request reflects the existing
 * decision and strips the buttons; expired/cancelled requests show their
 * status and do not mutate state.
 */
async function handleApprovalDecision(
  action: "approve_request" | "deny_request",
  requestId: string,
  expertUserId: string,
): Promise<NextResponse> {
  const decision = action === "approve_request" ? "approved" : "denied";

  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      id: requestId,
      expertId: expertUserId,
      requiresApproval: true,
      probe: false,
    },
  });

  if (!helpRequest) {
    return updateMessageResponse("Request not found.");
  }

  if (helpRequest.approvalDecision) {
    return updateMessageResponse(
      `Request \`${helpRequest.refCode}\` — Already ${helpRequest.approvalDecision}`,
    );
  }

  if (
    helpRequest.status === "expired" ||
    helpRequest.status === "cancelled"
  ) {
    return updateMessageResponse(
      `Request \`${helpRequest.refCode}\` — Request is ${helpRequest.status}`,
    );
  }

  const now = new Date();

  await prisma.helpRequest.update({
    where: { id: helpRequest.id },
    data: {
      approvalDecision: decision,
      status: "responded",
      respondedAt: now,
    },
  });

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

  const label = decision === "approved" ? "✓ Approved" : "✗ Denied";
  return updateMessageResponse(
    `Request \`${helpRequest.refCode}\` — *Decision:* ${label}`,
  );
}

async function handleAckNotification(
  requestId: string,
  expertUserId: string,
): Promise<NextResponse> {
  const result = await acknowledgeNotification({
    requestId,
    expertUserId,
    source: "discord",
  });

  if (!result.ok) {
    const text =
      result.code === "NOT_APPLICABLE"
        ? "Notification not applicable — this request expects a reply."
        : "Notification not found.";
    return updateMessageResponse(text);
  }

  const label = result.alreadyAcknowledged
    ? "Already acknowledged"
    : "Acknowledged";
  return updateMessageResponse(`Notification — ${label}`);
}

/**
 * Open a Discord modal pre-populated with the request `refCode` and an
 * editable answer field. Modal submission (type MODAL_SUBMIT) is handled in
 * HEY-455-E and writes the plaintext reply via the existing services.
 */
async function handleReplyOpenModal(
  requestId: string,
  expertUserId: string,
): Promise<NextResponse> {
  const helpRequest = await prisma.helpRequest.findFirst({
    where: { id: requestId, expertId: expertUserId, probe: false },
    select: { id: true, refCode: true, status: true },
  });

  if (!helpRequest) {
    return updateMessageResponse("Request not found.");
  }

  if (
    helpRequest.status === "closed" ||
    helpRequest.status === "expired" ||
    helpRequest.status === "cancelled"
  ) {
    return updateMessageResponse(
      `Request \`${helpRequest.refCode}\` — Request is ${helpRequest.status}`,
    );
  }

  return NextResponse.json({
    type: InteractionResponseType.MODAL,
    data: {
      custom_id: `reply_modal:${helpRequest.id}`,
      title: `Reply to ${helpRequest.refCode}`.slice(0, 45),
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "refCode",
              label: "Reference code",
              style: TextInputStyle.SHORT,
              value: helpRequest.refCode,
              min_length: helpRequest.refCode.length,
              max_length: helpRequest.refCode.length,
              required: true,
            },
          ],
        },
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: "answer",
              label: "Answer",
              style: TextInputStyle.PARAGRAPH,
              min_length: 1,
              max_length: MODAL_ANSWER_MAX_LENGTH,
              required: true,
            },
          ],
        },
      ],
    },
  });
}

/**
 * Build a type-7 UPDATE_MESSAGE response that replaces the original message
 * content and strips its component row.
 */
function updateMessageResponse(content: string): NextResponse {
  return NextResponse.json({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      content,
      components: [],
      allowed_mentions: { parse: [] },
    },
  });
}

function deferredUpdate(): NextResponse {
  return NextResponse.json({
    type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE,
  });
}

/**
 * Verify a Discord interaction request signature.
 *
 * Discord signs the concatenation of `timestamp + rawBody` with Ed25519 using
 * the application's public key (32 raw bytes, hex-encoded). The signature is
 * 64 raw bytes, hex-encoded. Any malformed input -> false (never throw).
 */
export function verifyDiscordSignature(
  publicKeyHex: string,
  timestamp: string,
  rawBody: string,
  signatureHex: string,
): boolean {
  try {
    const key = ed25519PublicKeyFromHex(publicKeyHex);
    if (!key) return false;

    const sig = Buffer.from(signatureHex, "hex");
    if (sig.length !== 64) return false;

    const message = Buffer.from(timestamp + rawBody, "utf8");
    return verify(null, message, key, sig);
  } catch {
    return false;
  }
}

function ed25519PublicKeyFromHex(publicKeyHex: string): KeyObject | null {
  if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHex)) return null;
  const raw = Buffer.from(publicKeyHex, "hex");
  if (raw.length !== 32) return null;
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  try {
    return createPublicKey({ key: der, format: "der", type: "spki" });
  } catch {
    return null;
  }
}
