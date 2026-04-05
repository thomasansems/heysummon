export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { keyExchangeSchema, validateBody } from "@/lib/validations";
import { sanitizeError } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/v1/key-exchange/:requestId — Expert sends their public keys
 *
 * This completes the key exchange: consumer already sent their keys in POST /help,
 * now expert sends theirs and both can derive the shared secret via X25519 DH.
 *
 * Required: signPublicKey, encryptPublicKey
 * Returns: { success: true }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const raw = await request.json();
    const parsed = validateBody(keyExchangeSchema, raw);
    if (!parsed.success) return parsed.response;

    const { signPublicKey, encryptPublicKey } = parsed.data;

    // Find the help request
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
    });

    if (!helpRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (helpRequest.status === "closed" || helpRequest.status === "expired") {
      return NextResponse.json(
        { error: "Request is already closed or expired" },
        { status: 400 }
      );
    }

    if (helpRequest.expertSignPubKey || helpRequest.expertEncryptPubKey) {
      return NextResponse.json(
        { error: "Expert keys already exchanged for this request" },
        { status: 400 }
      );
    }

    // Store expert's public keys and set status to active
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        expertSignPubKey: signPublicKey,
        expertEncryptPubKey: encryptPublicKey,
        status: "active",
      },
    });

    logAuditEvent({
      eventType: AuditEventTypes.KEY_EXCHANGE,
      userId: helpRequest.expertId,
      success: true,
      metadata: { requestId },
      request,
    });

    return NextResponse.json({
      success: true,
      status: "active",
    });
  } catch (err) {
    console.error("Key exchange error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
