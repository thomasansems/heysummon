export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateProviderKey } from "@/lib/provider-key-auth";

const DEBUG = process.env.DEBUG === "true";

/**
 * POST /api/v1/approve/[requestId] — Approve or deny a request
 *
 * Auth: provider key (x-api-key: hs_prov_*)
 * Body: { decision: "approved" | "denied" }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const result = await validateProviderKey(request);
  if (!result.ok) return result.response;

  const { requestId } = await params;

  if (DEBUG) {
    console.log(`[POST /api/v1/approve/${requestId}] Request received from provider:`, {
      provider: result.provider.name,
      userId: result.provider.userId,
    });
  }

  let body: { decision?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { decision } = body;

  if (DEBUG) {
    console.log(`[POST /api/v1/approve/${requestId}] Decision received:`, { decision });
  }
  if (decision !== "approved" && decision !== "denied") {
    return NextResponse.json(
      { error: "decision must be \"approved\" or \"denied\"" },
      { status: 400 }
    );
  }

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
  });

  if (!helpRequest || helpRequest.expertId !== result.provider.userId) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!helpRequest.requiresApproval) {
    return NextResponse.json(
      { error: "This request does not require approval" },
      { status: 400 }
    );
  }

  if (helpRequest.approvalDecision) {
    return NextResponse.json(
      { error: "Decision already made", decision: helpRequest.approvalDecision },
      { status: 409 }
    );
  }

  if (helpRequest.status === "expired" || helpRequest.status === "cancelled") {
    return NextResponse.json(
      { error: `Request is ${helpRequest.status}` },
      { status: 400 }
    );
  }

  const now = new Date();

  // Update request with decision
  const updated = await prisma.helpRequest.update({
    where: { id: requestId },
    data: {
      approvalDecision: decision,
      status: "responded",
      respondedAt: now,
    },
  });

  // Create a MessageHistory entry so consumer can see the decision
  await prisma.message.create({
    data: {
      requestId,
      from: "provider",
      ciphertext: decision,
      iv: "",
      authTag: "",
      signature: "",
      messageId: `approval-${requestId}-${Date.now()}`,
    },
  });

  if (DEBUG) {
    console.log(`[POST /api/v1/approve/${requestId}] Decision saved:`, {
      requestId: updated.id,
      refCode: updated.refCode,
      approvalDecision: updated.approvalDecision,
      status: updated.status,
      respondedAt: updated.respondedAt,
    });
  }

  return NextResponse.json({
    success: true,
    decision,
    refCode: updated.refCode,
  });
}
