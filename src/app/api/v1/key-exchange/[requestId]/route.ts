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
    const provider = authResult.provider;

    // Atomic check-and-set: collapse the TOCTOU window to zero.
    // The WHERE clause ensures only one concurrent request can succeed —
    // keys must be null and request must be in a valid state.
    const result = await prisma.helpRequest.updateMany({
      where: {
        id: requestId,
        expertId: provider.userId,
        providerSignPubKey: null,
        providerEncryptPubKey: null,
        status: { notIn: ["closed", "expired"] },
      },
      data: {
        providerSignPubKey: signPublicKey,
        providerEncryptPubKey: encryptPublicKey,
        status: "active",
      },
    });

    if (result.count === 0) {
      // Atomic update matched zero rows — determine the specific error
      const existing = await prisma.helpRequest.findUnique({
        where: { id: requestId },
      });

      if (!existing) {
        return NextResponse.json(
          { error: "Request not found" },
          { status: 404 }
        );
      }
      if (existing.expertId !== provider.userId) {
        return NextResponse.json(
          { error: "Not authorized for this request" },
          { status: 403 }
        );
      }
      if (existing.providerSignPubKey || existing.providerEncryptPubKey) {
        return NextResponse.json(
          { error: "Provider keys already exchanged for this request" },
          { status: 409 }
        );
      }
      // closed/expired
      return NextResponse.json(
        { error: "Request is already closed or expired" },
        { status: 400 }
      );
    }

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
