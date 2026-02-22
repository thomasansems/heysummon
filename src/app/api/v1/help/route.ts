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

const REQUIRE_GUARD = process.env.REQUIRE_GUARD === "true";

/**
 * POST /api/v1/help — Submit a help request.
 *
 * Guard flow (pre-flight validation):
 *   1. Skill calls Guard → gets signature
 *   2. Skill calls this endpoint with guardSignature, guardTimestamp, guardNonce
 *   3. Platform verifies HMAC(question + timestamp + nonce) matches signature
 *
 * If REQUIRE_GUARD=true, guard signature fields are mandatory.
 * If not set, guard is optional (backward compatible).
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = validateBody(helpCreateSchema, raw);
    if (!parsed.success) return parsed.response;

    const { 
      apiKey, 
      signPublicKey,
      encryptPublicKey,
      messages, 
      question, 
      publicKey,
      messageCount,
      // Guard pre-flight signature fields
      guardSignature,
      guardTimestamp,
      guardNonce,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "apiKey is required" },
        { status: 400 }
      );
    }

    if (!signPublicKey || !encryptPublicKey) {
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

    // ─── Guard Pre-flight Signature Verification ───
    const rawQuestion = question || (Array.isArray(messages) && messages.length > 0
      ? messages.map((m: { content?: string }) => m.content || "").join("\n")
      : null);

    const hasGuardFields = guardSignature && guardTimestamp && guardNonce;

    if (REQUIRE_GUARD && rawQuestion && !hasGuardFields) {
      return NextResponse.json(
        { error: "Guard validation required. Call the guard service first and include guardSignature, guardTimestamp, guardNonce." },
        { status: 422 }
      );
    }

    let contentFlags = null;

    if (hasGuardFields && rawQuestion) {
      const hmacSecret = process.env.GUARD_HMAC_SECRET || "";
      if (!hmacSecret) {
        return NextResponse.json(
          { error: "Guard HMAC secret not configured on server" },
          { status: 500 }
        );
      }

      if (!verifyValidationToken(
        guardSignature,
        rawQuestion,
        guardTimestamp,
        guardNonce,
        hmacSecret
      )) {
        return NextResponse.json(
          { error: "Invalid guard signature. Content may have been tampered with, or signature expired." },
          { status: 422 }
        );
      }

      // Guard signature verified — content passed through guard
      // Flags would have been handled by the guard (blocked content never reaches here)
      contentFlags = null; // Guard already filtered
    }

    const refCode = await generateUniqueRefCode();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

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
        
        consumerSignPubKey: signPublicKey || null,
        consumerEncryptPubKey: encryptPublicKey || null,
        
        messages: encryptedMessages,
        question: encryptedQuestion,
        consumerPublicKey: publicKey || null,
        serverPublicKey: serverKeyPair?.publicKey || null,
        serverPrivateKey: serverKeyPair?.privateKey || null,
        
        contentFlags: contentFlags ? JSON.stringify(contentFlags) : null,
        guardVerified: hasGuardFields ? true : false,
      },
    });

    // Publish to Mercure
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
    }

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      expiresAt: helpRequest.expiresAt.toISOString(),
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
