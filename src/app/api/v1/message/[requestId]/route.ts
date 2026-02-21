export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToMercure } from "@/lib/mercure";

/**
 * POST /api/v1/message/:requestId — Send an encrypted message
 *
 * Both consumer and provider can send messages after key exchange.
 * Messages are encrypted with AES-256-GCM (derived via X25519 DH + HKDF)
 * and signed with Ed25519.
 *
 * Required: from ("consumer"|"provider"), ciphertext, iv, authTag, signature, messageId
 * Returns: { success: true, messageId }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;
    const body = await request.json();
    const { from, plaintext } = body;
    let { ciphertext, iv, authTag, signature, messageId } = body;

    if (!from) {
      return NextResponse.json(
        { error: "from is required" },
        { status: 400 }
      );
    }

    // Support plaintext messages (unencrypted, for simple reply flows)
    if (plaintext && !ciphertext) {
      const crypto = await import("node:crypto");
      ciphertext = Buffer.from(plaintext).toString("base64");
      iv = "plaintext";
      authTag = "plaintext";
      signature = "plaintext";
      messageId = messageId || crypto.randomUUID();
    }

    if (!ciphertext || !iv || !authTag || !signature || !messageId) {
      return NextResponse.json(
        { error: "from + (plaintext | ciphertext+iv+authTag+signature+messageId) required" },
        { status: 400 }
      );
    }

    if (from !== "consumer" && from !== "provider") {
      return NextResponse.json(
        { error: "from must be 'consumer' or 'provider'" },
        { status: 400 }
      );
    }

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
        { error: "Request is closed or expired" },
        { status: 400 }
      );
    }

    // Check that key exchange has happened (for v4 encrypted messages)
    const isPlaintext = iv === "plaintext";
    if (!isPlaintext) {
      if (from === "provider" && (!helpRequest.providerSignPubKey || !helpRequest.providerEncryptPubKey)) {
        return NextResponse.json(
          { error: "Provider must exchange keys first (POST /key-exchange)" },
          { status: 400 }
        );
      }

      if (from === "consumer" && (!helpRequest.consumerSignPubKey || !helpRequest.consumerEncryptPubKey)) {
        return NextResponse.json(
          { error: "Consumer keys not found — must be sent in POST /help" },
          { status: 400 }
        );
      }
    }

    // Check for duplicate messageId
    const existing = await prisma.message.findUnique({
      where: { messageId },
    });

    if (existing) {
      // Idempotent: return success if already stored
      return NextResponse.json({
        success: true,
        messageId,
        duplicate: true,
      });
    }

    // Update status to responded when provider sends a message
    if (from === "provider" && helpRequest.status !== "responded") {
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: { status: "responded", respondedAt: new Date() },
      });
    }

    // Store the message
    const message = await prisma.message.create({
      data: {
        requestId,
        from,
        ciphertext,
        iv,
        authTag,
        signature,
        messageId,
      },
    });

    // Publish to Mercure: notify both parties
    try {
      await Promise.all([
        // Notify consumer (on request topic)
        publishToMercure(
          `/heysummon/requests/${requestId}`,
          {
            type: 'new_message',
            requestId,
            messageId,
            from,
            createdAt: message.createdAt.toISOString(),
          }
        ),
        // Notify provider (on provider topic)
        publishToMercure(
          `/heysummon/providers/${helpRequest.expertId}`,
          {
            type: 'new_message',
            requestId,
            refCode: helpRequest.refCode,
            messageId,
            from,
            createdAt: message.createdAt.toISOString(),
          }
        ),
      ]);
    } catch (mercureError) {
      console.error('Mercure publish failed (non-fatal):', mercureError);
    }

    return NextResponse.json({
      success: true,
      messageId: message.messageId,
      createdAt: message.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Message send error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
