export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToMercure } from "@/lib/mercure";
import { keyExchangeSchema, validateBody } from "@/lib/validations";
import { sanitizeError } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/v1/key-exchange/:requestId — Provider sends their public keys
 *
 * This completes the key exchange: consumer already sent their keys in POST /help,
 * now provider sends theirs and both can derive the shared secret via X25519 DH.
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

    if (helpRequest.providerSignPubKey || helpRequest.providerEncryptPubKey) {
      return NextResponse.json(
        { error: "Provider keys already exchanged for this request" },
        { status: 400 }
      );
    }

    // Store provider's public keys and set status to active
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        providerSignPubKey: signPublicKey,
        providerEncryptPubKey: encryptPublicKey,
        status: "active",
      },
    });

    // Publish to Mercure: notify consumer that keys are exchanged
    try {
      await publishToMercure(
        `/heysummon/requests/${requestId}`,
        {
          type: 'keys_exchanged',
          requestId,
          providerSignPubKey: signPublicKey,
          providerEncryptPubKey: encryptPublicKey,
        }
      );
    } catch (mercureError) {
      console.error('Mercure publish failed (non-fatal):', mercureError);
    }

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
