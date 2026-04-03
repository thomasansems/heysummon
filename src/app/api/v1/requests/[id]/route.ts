import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptMessage } from "@/lib/crypto";
import { requestPatchSchema, validateBody } from "@/lib/validations";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import { sendResponseToTelegram } from "@/lib/adapters/telegram";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id },
    include: { apiKey: { select: { name: true } } },
  });

  if (!helpRequest || helpRequest.expertId !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Auto-mark as reviewing when expert opens it
  if (helpRequest.status === "pending") {
    await prisma.helpRequest.update({
      where: { id },
      data: { status: "reviewing" },
    });
    helpRequest.status = "reviewing";
  }

  // Decrypt messages and question for expert view using server private key
  let decryptedMessages: unknown;
  let decryptedQuestion: string | null = null;

  if (helpRequest.messages && helpRequest.serverPrivateKey) {
    try {
      decryptedMessages = JSON.parse(
        decryptMessage(helpRequest.messages, helpRequest.serverPrivateKey)
      );
    } catch {
      decryptedMessages = [{ role: "system", content: "[Decryption failed]" }];
    }
  } else {
    decryptedMessages = [];
  }

  if (helpRequest.question && helpRequest.serverPrivateKey) {
    try {
      decryptedQuestion = decryptMessage(helpRequest.question, helpRequest.serverPrivateKey);
    } catch {
      decryptedQuestion = "[Decryption failed]";
    }
  }

  return NextResponse.json({
    request: {
      id: helpRequest.id,
      refCode: helpRequest.refCode,
      status: helpRequest.status,
      messages: decryptedMessages,
      question: decryptedQuestion,
      questionPreview: helpRequest.questionPreview || null,
      requiresApproval: helpRequest.requiresApproval,
      approvalDecision: helpRequest.approvalDecision || null,
      response: helpRequest.response,
      createdAt: helpRequest.createdAt,
      updatedAt: helpRequest.updatedAt,
      respondedAt: helpRequest.respondedAt,
      deliveredAt: helpRequest.deliveredAt,
      expiresAt: helpRequest.expiresAt,
      apiKey: helpRequest.apiKey,
      phoneCallStatus: helpRequest.phoneCallStatus || null,
      phoneCallAt: helpRequest.phoneCallAt || null,
      phoneCallResponse: helpRequest.phoneCallResponse || null,
      phoneCallSid: helpRequest.phoneCallSid || null,
      clientTimedOutAt: helpRequest.clientTimedOutAt || null,
      contentFlags: helpRequest.contentFlags ? JSON.parse(helpRequest.contentFlags) : null,
      guardVerified: helpRequest.guardVerified,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const raw = await request.json();
  const parsed = validateBody(requestPatchSchema, raw);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;

  const helpRequest = await prisma.helpRequest.findUnique({ where: { id } });
  if (!helpRequest || helpRequest.expertId !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (helpRequest.status === "expired") {
    return NextResponse.json({ error: "Request has expired" }, { status: 400 });
  }

  if (helpRequest.status === "responded") {
    return NextResponse.json({ error: "Already responded" }, { status: 400 });
  }

  // Store plaintext response — consumer gets it encrypted via polling endpoint
  const updated = await prisma.helpRequest.update({
    where: { id },
    data: {
      response: body.response,
      status: "responded",
      respondedAt: new Date(),
    },
  });

  logAuditEvent({
    eventType: AuditEventTypes.EXPERT_RESPONSE,
    userId: user.id,
    success: true,
    metadata: { requestId: id, refCode: updated.refCode },
    request,
  });

  // Send response back via Telegram if the request came from that channel
  try {
    await sendResponseToTelegram(updated.id, body.response);
  } catch { /* non-fatal */ }

  return NextResponse.json({
    request: {
      id: updated.id,
      refCode: updated.refCode,
      status: updated.status,
      respondedAt: updated.respondedAt,
    },
  });
}
