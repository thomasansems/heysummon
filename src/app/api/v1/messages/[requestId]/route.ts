export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";

/**
 * GET /api/v1/messages/:requestId — Fetch message history
 *
 * Authentication: x-api-key header required.
 * Returns encrypted message blobs. Client must decrypt them locally
 * using the shared secret derived from X25519 DH + HKDF.
 *
 * Returns: { messages: [ { id, from, ciphertext, iv, authTag, signature, messageId, createdAt }, ... ] }
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    // Authenticate via API key
    const authResult = await validateApiKeyRequest(request);
    if (!authResult.ok) return authResult.response;

    // Find the help request
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
      include: {
        messageHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!helpRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    // Return encrypted message blobs
    const messages = helpRequest.messageHistory.map((msg) => ({
      id: msg.id,
      from: msg.from,
      ciphertext: msg.ciphertext,
      iv: msg.iv,
      authTag: msg.authTag,
      signature: msg.signature,
      messageId: msg.messageId,
      createdAt: msg.createdAt.toISOString(),
    }));

    return NextResponse.json({
      requestId,
      refCode: helpRequest.refCode,
      status: helpRequest.status,
      consumerSignPubKey: helpRequest.consumerSignPubKey,
      consumerEncryptPubKey: helpRequest.consumerEncryptPubKey,
      providerSignPubKey: helpRequest.providerSignPubKey,
      providerEncryptPubKey: helpRequest.providerEncryptPubKey,
      messages,
      expiresAt: helpRequest.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("Fetch messages error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
