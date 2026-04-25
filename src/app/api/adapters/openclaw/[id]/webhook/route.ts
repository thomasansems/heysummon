import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature, verifyQueryActionSignature } from "@/lib/adapters/openclaw";
import type { OpenClawConfig } from "@/lib/adapters/types";

/** Max length for an expert reply via OpenClaw */
const MAX_REPLY_LENGTH = 10_000;

const callbackSchema = z.object({
  action: z.enum(["approve", "deny", "reply"]),
  requestId: z.string().min(1),
  message: z.string().max(MAX_REPLY_LENGTH).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  if (!channel || channel.type !== "openclaw" || !channel.isActive) {
    return NextResponse.json(
      { error: "Channel not found" },
      { status: 404 },
    );
  }

  const config = JSON.parse(channel.config) as OpenClawConfig & { webhookSecret?: string };

  // Verify webhook signature
  const signature = request.headers.get("x-openclaw-signature") ?? "";

  if (
    !config.webhookSecret ||
    !signature ||
    !verifyWebhookSignature(config.webhookSecret, rawBody, signature)
  ) {
    // Also check query-param based actions (approve/deny URLs from notification).
    // The action URL must carry an HMAC signature bound to (action, requestId)
    // signed with the channel's webhookSecret. Without this, anyone who learned
    // a channel id and request id could forge an approve/deny call.
    const url = new URL(request.url);
    const queryAction = url.searchParams.get("action");
    const queryRequestId = url.searchParams.get("requestId");
    const querySig = url.searchParams.get("sig");

    if (queryAction && queryRequestId && querySig && config.webhookSecret) {
      const valid = verifyQueryActionSignature(
        config.webhookSecret,
        queryAction,
        queryRequestId,
        querySig,
      );
      if (valid) {
        return handleQueryAction(queryAction, queryRequestId, channel, config);
      }
    }

    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // Parse the callback body
  let parsed: z.infer<typeof callbackSchema>;
  try {
    const raw = JSON.parse(rawBody);
    const result = callbackSchema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: result.error.format() },
        { status: 400 },
      );
    }
    parsed = result.data;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (parsed.action === "reply") {
    return handleReply(parsed.requestId, parsed.message ?? "", channel);
  }

  return handleApproval(parsed.action, parsed.requestId, channel);
}

/**
 * Handle query-param based approve/deny.
 * Caller in the POST handler MUST verify the action URL signature first via
 * verifyQueryActionSignature(); this function only enforces the action enum.
 */
async function handleQueryAction(
  action: string,
  requestId: string,
  channel: { id: string; profile: { userId: string } },
  _config: OpenClawConfig & { webhookSecret?: string },
): Promise<NextResponse> {
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  return handleApproval(action, requestId, channel);
}

/** Handle approve/deny actions */
async function handleApproval(
  action: "approve" | "deny",
  requestId: string,
  channel: { id: string; profile: { userId: string } },
): Promise<NextResponse> {
  const decision = action === "approve" ? "approved" : "denied";

  // Find the help request -- must belong to this expert
  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      id: requestId,
      expertId: channel.profile.userId,
      requiresApproval: true,
      probe: false,
    },
  });

  if (!helpRequest) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 },
    );
  }

  // Prevent double-decision
  if (helpRequest.approvalDecision) {
    return NextResponse.json({
      ok: true,
      message: `Request already ${helpRequest.approvalDecision}`,
      decision: helpRequest.approvalDecision,
    });
  }

  // Reject if expired/cancelled
  if (helpRequest.status === "expired" || helpRequest.status === "cancelled") {
    return NextResponse.json({
      ok: true,
      message: `Request is ${helpRequest.status}`,
      status: helpRequest.status,
    });
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

  const label = decision === "approved" ? "\u2713 Approved" : "\u2717 Denied";

  return NextResponse.json({
    ok: true,
    message: `Request ${helpRequest.refCode} -- Decision: ${label}`,
    decision,
  });
}

/** Handle reply actions */
async function handleReply(
  requestId: string,
  answer: string,
  channel: { id: string; profile: { userId: string } },
): Promise<NextResponse> {
  if (!answer || answer.trim().length === 0) {
    return NextResponse.json(
      { error: "Message is required for reply action" },
      { status: 400 },
    );
  }

  if (answer.length > MAX_REPLY_LENGTH) {
    return NextResponse.json(
      { error: `Reply is too long (${answer.length} chars). Maximum is ${MAX_REPLY_LENGTH}.` },
      { status: 400 },
    );
  }

  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      id: requestId,
      expertId: channel.profile.userId,
      status: { notIn: ["closed", "expired"] },
      probe: false,
    },
  });

  if (!helpRequest) {
    return NextResponse.json(
      { error: "Request not found or already closed" },
      { status: 404 },
    );
  }

  const now = new Date();

  await prisma.helpRequest.update({
    where: { id: helpRequest.id },
    data: {
      response: answer.trim(),
      status: "responded",
      respondedAt: now,
    },
  });

  // Create a Message record for consumer polling
  const plainB64 = Buffer.from(answer.trim(), "utf-8").toString("base64");
  await prisma.message.create({
    data: {
      requestId: helpRequest.id,
      from: "expert",
      ciphertext: `plaintext:${plainB64}`,
      iv: "plaintext",
      authTag: "plaintext",
      signature: "plaintext",
      messageId: `openclaw-${randomUUID()}`,
    },
  });

  return NextResponse.json({
    ok: true,
    message: `Reply sent for ${helpRequest.refCode}`,
  });
}
