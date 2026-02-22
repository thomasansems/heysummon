export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptMessage } from "@/lib/crypto";
import { publishToMercure } from "@/lib/mercure";
import { validateApiKeyRequest } from "@/lib/api-key-auth";

/**
 * GET /api/v1/help/:requestId — Poll for response.
 *
 * Consumer polls this endpoint. When status = "responded",
 * the response is encrypted with the consumer's public key.
 *
 * Statuses: pending → reviewing → responded | expired
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    include: { apiKey: { select: { key: true } } },
  });

  // If x-api-key header provided, verify it matches the request's API key + device token
  const providedApiKey = _request.headers.get("x-api-key");
  if (providedApiKey) {
    const authResult = await validateApiKeyRequest(_request);
    if (!authResult.ok) return authResult.response;
    if (helpRequest?.apiKey?.key !== providedApiKey) {
      return NextResponse.json({ error: "Invalid API key for this request" }, { status: 403 });
    }
  }

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Auto-expire
  if (helpRequest.status === "pending" && new Date() > helpRequest.expiresAt) {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { status: "expired" },
    });
    try {
      await publishToMercure(`/heysummon/providers/${helpRequest.expertId}`, {
        type: "status_change",
        requestId: helpRequest.id,
        refCode: helpRequest.refCode,
        status: "expired",
      });
    } catch { /* non-fatal */ }
    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "expired",
    });
  }

  const res: Record<string, unknown> = {
    requestId: helpRequest.id,
    refCode: helpRequest.refCode,
    status: helpRequest.status,
    createdAt: helpRequest.createdAt.toISOString(),
    expiresAt: helpRequest.expiresAt.toISOString(),
  };

  if (helpRequest.respondedAt) {
    res.respondedAt = helpRequest.respondedAt.toISOString();
  }

  // When responded, return the response
  if (helpRequest.status === "responded" && helpRequest.response) {
    if (helpRequest.consumerPublicKey) {
      // v3 legacy: encrypt with RSA
      try {
        res.encryptedResponse = encryptMessage(
          helpRequest.response,
          helpRequest.consumerPublicKey
        );
      } catch {
        // If encryption fails, fall through to plaintext
        res.response = helpRequest.response;
      }
    } else {
      // v4: response sent as plaintext (E2E encryption happens via /api/v1/message endpoint)
      res.response = helpRequest.response;
    }
  }

  return NextResponse.json(res);
}
