export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToMercure } from "@/lib/mercure";
import { messageCreateSchema, validateBody } from "@/lib/validations";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";

/**
 * POST /api/v1/message/:requestId — Send a message (encrypted or plaintext)
 *
 * Authentication: x-api-key header required.
 *   - Provider key (hs_prov_*) → can send as "provider"
 *   - Client key (hs_cli_*)    → can send as "consumer"
 *
 * The API validates that the key has access to this specific request.
 *
 * Required: from ("consumer"|"provider"), + either plaintext or encrypted fields
 * Returns: { success: true, messageId }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    // ── Auth: require x-api-key ──
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing x-api-key header" },
        { status: 401 }
      );
    }

    // Determine caller role from key type
    let callerRole: "provider" | "consumer" | null = null;

    // Check provider key
    const provider = await prisma.userProfile.findFirst({
      where: { key: apiKey, isActive: true },
      select: { id: true, userId: true },
    });

    if (provider) {
      // Verify this provider owns the request
      const helpRequest = await prisma.helpRequest.findFirst({
        where: { id: requestId, expertId: provider.userId },
      });
      if (!helpRequest) {
        return NextResponse.json(
          { error: "Request not found or not assigned to this provider" },
          { status: 403 }
        );
      }
      callerRole = "provider";
    }

    if (!callerRole) {
      // Check client key via enhanced validation (scope, IP, rate limit, rotation, device token)
      const authResult = await validateApiKeyRequest(request);
      if (authResult.ok) {
        const clientKey = authResult.apiKey;
        // Verify this client owns the request
        const helpRequest = await prisma.helpRequest.findFirst({
          where: { id: requestId, apiKey: { userId: clientKey.userId } },
        });
        if (!helpRequest) {
          return NextResponse.json(
            { error: "Request not found or not owned by this client" },
            { status: 403 }
          );
        }
        callerRole = "consumer";
      }
    }

    if (!callerRole) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // ── Parse body ──
    const raw = await request.json();
    const parsed = validateBody(messageCreateSchema, raw);
    if (!parsed.success) return parsed.response;

    const { from, plaintext } = parsed.data;
    let { ciphertext, iv, authTag, signature, messageId } = parsed.data;

    // Enforce: callerRole must match "from" claim
    if (from !== callerRole) {
      return NextResponse.json(
        { error: `API key role (${callerRole}) does not match from (${from})` },
        { status: 403 }
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

    // ── Find request ──
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
    console.error("Message send error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
