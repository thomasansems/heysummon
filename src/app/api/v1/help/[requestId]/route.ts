export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptMessage } from "@/lib/crypto";

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

  // If x-api-key header provided, verify it matches the request's API key
  const providedApiKey = _request.headers.get("x-api-key");
  if (providedApiKey && helpRequest?.apiKey?.key !== providedApiKey) {
    return NextResponse.json({ error: "Invalid API key for this request" }, { status: 403 });
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

  // When responded, encrypt the response with consumer's public key
  if (helpRequest.status === "responded" && helpRequest.response) {
    res.encryptedResponse = encryptMessage(
      helpRequest.response,
      helpRequest.consumerPublicKey
    );
  }

  return NextResponse.json(res);
}
