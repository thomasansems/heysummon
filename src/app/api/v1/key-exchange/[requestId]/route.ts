export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateProviderKey } from "@/lib/provider-key-auth";
import { keyExchangeSchema, validateBody } from "@/lib/validations";
import { sanitizeError } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/v1/key-exchange/:requestId — Provider sends their public keys
 *
 * API-key authenticated (x-api-key with hs_prov_* prefix).
 * Only the assigned provider (expertId) can exchange keys.
 * This completes the key exchange: consumer already sent their keys in POST /help,
 * now provider sends theirs and both can derive the shared secret via X25519 DH.
 *
 * Required: signPublicKey, encryptPublicKey
 * Returns: { success: true }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const authResult = await validateProviderKey(request);
    if (!authResult.ok) return authResult.response;

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

    const provider = authResult.provider;

    // Only the assigned provider can exchange keys
    if (helpRequest.expertId !== provider.userId) {
      return NextResponse.json(
        { error: "Not authorized for this request" },
        { status: 403 }
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
        { status: 409 }
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

    logAuditEvent({
      eventType: AuditEventTypes.KEY_EXCHANGE,
      userId: provider.userId,
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
