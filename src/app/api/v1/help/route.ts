export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";
import { publishToMercure } from "@/lib/mercure";
import { helpCreateSchema, validateBody } from "@/lib/validations";
import { validateContent as guardValidate } from "@/lib/guard-client";
import { verifyValidationToken } from "@/lib/guard-crypto";
import { hashDeviceToken } from "@/lib/api-key-auth";

/**
 * POST /api/v1/help — Submit a help request.
 *
 * v4 (Mercure + E2E):
 * Required: apiKey, signPublicKey, encryptPublicKey
 * Optional: messages[] (legacy), question (legacy), publicKey (legacy v3)
 *
 * Returns: requestId, refCode, status, expiresAt
 * Consumer subscribes to Mercure topic /heysummon/requests/{requestId} for realtime updates.
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = validateBody(helpCreateSchema, raw);
    if (!parsed.success) return parsed.response;

    const { 
      apiKey, 
      signPublicKey,     // v4: Ed25519 signing public key
      encryptPublicKey,  // v4: X25519 encryption public key
      // Legacy v3 fields (backward compatibility):
      messages, 
      question, 
      publicKey,         // v3: RSA public key
      messageCount,      // Optional: limit number of history messages (0, 5, 10, 20)
    } = parsed.data;

    // v4: Require E2E keys
    if (!signPublicKey || !encryptPublicKey) {
      // v3 fallback: allow old publicKey field
      if (!publicKey) {
        return NextResponse.json(
          { error: "signPublicKey and encryptPublicKey are required (or publicKey for legacy v3)" },
          { status: 400 }
        );
      }
    }

    // Validate API key
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!key || !key.isActive) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    // ─── Content Safety Guard ───
    let contentFlags = null;
    let guardEncryptedPayload = null;
    const rawQuestion = question || (Array.isArray(messages) && messages.length > 0
      ? messages.map((m: { content?: string }) => m.content || "").join("\n")
      : null);

    if (rawQuestion) {
      const guardResult = await guardValidate(rawQuestion);
      if (guardResult) {
        // Verify HMAC token
        const hmacSecret = process.env.GUARD_HMAC_SECRET || "";
        if (hmacSecret && !verifyValidationToken(
          guardResult.validationToken,
          guardResult.sanitizedText,
          guardResult.timestamp,
          guardResult.nonce,
          hmacSecret
        )) {
          return NextResponse.json(
            { error: "Content validation failed: invalid guard token" },
            { status: 422 }
          );
        }

        if (guardResult.blocked) {
          return NextResponse.json(
            { error: "Content blocked by safety filter", flags: guardResult.flags },
            { status: 422 }
          );
        }

        if (guardResult.flags.length > 0) {
          contentFlags = guardResult.flags;
        }
        guardEncryptedPayload = guardResult.encryptedPayload;
      }
    }

    // Validate device token if key has device binding
    if (key.deviceSecret) {
      const deviceToken = request.headers.get("x-device-token");
      if (!deviceToken || hashDeviceToken(deviceToken) !== key.deviceSecret) {
        return NextResponse.json(
          { error: "Invalid or missing device token" },
          { status: 403 }
        );
      }
    }

    const refCode = await generateUniqueRefCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

    // v3 legacy: encrypt messages at rest with server key
    let encryptedMessages = null;
    let encryptedQuestion = null;
    let serverKeyPair = null;

    if (messages || question) {
      serverKeyPair = generateKeyPair();
      if (messages && Array.isArray(messages)) {
        const limit = typeof messageCount === 'number' ? messageCount : messages.length;
        const trimmedMessages = limit === 0 ? [] : messages.slice(-Math.min(limit, messages.length));
        encryptedMessages = encryptMessage(
          JSON.stringify(trimmedMessages),
          serverKeyPair.publicKey
        );
      }
      if (question) {
        encryptedQuestion = encryptMessage(question, serverKeyPair.publicKey);
      }
    }

    const helpRequest = await prisma.helpRequest.create({
      data: {
        refCode,
        apiKeyId: key.id,
        expertId: key.userId,
        expiresAt,
        
        // v4 fields
        consumerSignPubKey: signPublicKey || null,
        consumerEncryptPubKey: encryptPublicKey || null,
        
        // v3 legacy fields (backward compatibility)
        messages: encryptedMessages,
        question: encryptedQuestion,
        consumerPublicKey: publicKey || null,
        serverPublicKey: serverKeyPair?.publicKey || null,
        serverPrivateKey: serverKeyPair?.privateKey || null,
        
        // Content safety
        contentFlags: contentFlags ? JSON.stringify(contentFlags) : null,
        guardEncryptedPayload: guardEncryptedPayload || null,
      },
    });

    // Publish to Mercure: notify provider of new request
    try {
      await publishToMercure(
        `/heysummon/providers/${key.userId}`,
        {
          type: 'new_request',
          requestId: helpRequest.id,
          refCode: helpRequest.refCode,
          question: question || null,
          messageCount: Array.isArray(messages)
            ? (typeof messageCount === 'number' ? Math.min(messageCount, messages.length) : messages.length)
            : 0,
          messagePreview: Array.isArray(messages) && messages.length > 0
            ? messages[messages.length - 1]?.content?.slice(0, 240) || null
            : null,
          consumerSignPubKey: signPublicKey || null,
          consumerEncryptPubKey: encryptPublicKey || null,
          createdAt: helpRequest.createdAt.toISOString(),
          expiresAt: helpRequest.expiresAt.toISOString(),
        }
      );
    } catch (mercureError) {
      console.error('Mercure publish failed (non-fatal):', mercureError);
      // Continue — request is stored, provider can poll if Mercure is down
    }

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      expiresAt: helpRequest.expiresAt.toISOString(),
      // v3 legacy: return server public key if generated
      ...(serverKeyPair && { serverPublicKey: serverKeyPair.publicKey }),
    });
  } catch (err) {
    console.error("Help request error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
