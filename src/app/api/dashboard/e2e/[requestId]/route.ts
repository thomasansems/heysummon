import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { messageCreateSchema, validateBody, requireJsonContentType } from "@/lib/validations";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * GET /api/dashboard/e2e/:requestId
 *
 * Session-authenticated endpoint that returns raw encrypted messages and
 * E2E public keys. The dashboard decrypts client-side using Web Crypto.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    include: {
      messageHistory: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!helpRequest || helpRequest.expertId !== session.user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const messages = helpRequest.messageHistory.map((msg) => {
    const isPlaintext =
      msg.iv === "plaintext" && msg.ciphertext.startsWith("plaintext:");
    if (isPlaintext) {
      return {
        id: msg.id,
        from: msg.from,
        plaintext: Buffer.from(
          msg.ciphertext.slice("plaintext:".length),
          "base64",
        ).toString("utf-8"),
        messageId: msg.messageId,
        createdAt: msg.createdAt.toISOString(),
      };
    }
    return {
      id: msg.id,
      from: msg.from,
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      authTag: msg.authTag,
      signature: msg.signature,
      messageId: msg.messageId,
      createdAt: msg.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    requestId,
    status: helpRequest.status,
    consumerSignPubKey: helpRequest.consumerSignPubKey,
    consumerEncryptPubKey: helpRequest.consumerEncryptPubKey,
    expertSignPubKey: helpRequest.expertSignPubKey,
    expertEncryptPubKey: helpRequest.expertEncryptPubKey,
    messages,
    expiresAt: helpRequest.expiresAt.toISOString(),
  });
}

/**
 * POST /api/dashboard/e2e/:requestId
 *
 * Session-authenticated endpoint for the dashboard to send encrypted
 * messages as the expert. Bypasses x-api-key auth since the dashboard
 * authenticates via session.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const ctError = requireJsonContentType(request);
  if (ctError) return ctError;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await params;
  const raw = await request.json();
  const parsed = validateBody(messageCreateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { ciphertext, iv, authTag, signature, messageId } = parsed.data;

  if (!ciphertext || !iv || !authTag || !signature || !messageId) {
    return NextResponse.json(
      { error: "ciphertext, iv, authTag, signature, and messageId are required" },
      { status: 400 },
    );
  }

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
  });

  if (!helpRequest || helpRequest.expertId !== session.user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (helpRequest.status === "closed" || helpRequest.status === "expired") {
    return NextResponse.json(
      { error: "Request is closed or expired" },
      { status: 400 },
    );
  }

  if (!helpRequest.expertSignPubKey || !helpRequest.expertEncryptPubKey) {
    return NextResponse.json(
      { error: "Expert must exchange keys first" },
      { status: 400 },
    );
  }

  // Deduplicate by messageId
  const existing = await prisma.message.findUnique({ where: { messageId } });
  if (existing) {
    return NextResponse.json({ success: true, messageId, duplicate: true });
  }

  // Update request status on first expert message
  if (helpRequest.status !== "responded") {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { status: "responded", respondedAt: new Date() },
    });
  }

  const message = await prisma.message.create({
    data: {
      requestId,
      from: "expert",
      ciphertext,
      iv,
      authTag,
      signature,
      messageId,
    },
  });

  logAuditEvent({
    eventType: AuditEventTypes.EXPERT_RESPONSE,
    userId: session.user.id,
    success: true,
    metadata: { requestId, refCode: helpRequest.refCode, via: "dashboard-e2e" },
    request,
  });

  return NextResponse.json({
    success: true,
    messageId: message.messageId,
    createdAt: message.createdAt.toISOString(),
  });
}
