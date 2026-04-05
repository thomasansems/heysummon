export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { keyExchangeSchema, validateBody } from "@/lib/validations";
import { sanitizeError, validateApiKeyRequest } from "@/lib/api-key-auth";
import { auth } from "@/lib/auth-config";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * Authenticate via provider API key or session cookie.
 * Returns the authenticated user ID, or an error response.
 */
async function authenticateProvider(
  request: Request
): Promise<{ userId: string } | { response: NextResponse }> {
  // Option A: API key auth (external integrations)
  const apiKeyHeader = request.headers.get("x-api-key");
  if (apiKeyHeader) {
    const result = await validateApiKeyRequest(request);
    if (!result.ok) return { response: result.response };
    return { userId: result.apiKey.userId as string };
  }

  // Option B: Session auth (dashboard)
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id };
  }

  return {
    response: NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    ),
  };
}

/**
 * POST /api/v1/key-exchange/:requestId — Provider sends their public keys
 *
 * This completes the key exchange: consumer already sent their keys in POST /help,
 * now provider sends theirs and both can derive the shared secret via X25519 DH.
 *
 * Auth: provider API key (x-api-key) or session cookie.
 * Required: signPublicKey, encryptPublicKey
 * Returns: { success: true }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    // Authenticate the provider
    const authResult = await authenticateProvider(request);
    if ("response" in authResult) return authResult.response;
    const { userId } = authResult;

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

    // Verify the authenticated user owns this request
    if (helpRequest.expertId !== userId) {
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
