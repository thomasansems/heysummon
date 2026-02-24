export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";
import { publishToMercure } from "@/lib/mercure";
import { helpCreateSchema, validateBody } from "@/lib/validations";
import { verifyGuardReceipt } from "@/lib/guard-crypto";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import { hashDeviceToken } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes, redactApiKey } from "@/lib/audit";

const REQUIRE_GUARD = process.env.REQUIRE_GUARD === "true";
const REQUEST_TTL_MS = parseInt(process.env.HEYSUMMON_REQUEST_TTL_MS || String(72 * 60 * 60 * 1000), 10);

/**
 * POST /api/v1/help — Submit a help request.
 *
 * Guard reverse proxy flow:
 *   1. SDK sends request to Guard (single entry point)
 *   2. Guard validates content, signs Ed25519 receipt, proxies to Platform
 *   3. Platform verifies X-Guard-Receipt header
 *
 * If REQUIRE_GUARD=true, a valid guard receipt is mandatory.
 * If not set, guard is optional (backward compatible for dev without Guard).
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = validateBody(helpCreateSchema, raw);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;
    const {
      apiKey,
      signPublicKey,
      encryptPublicKey,
      messages,
      question,
      publicKey,
      messageCount,
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

    // Validate API key (body apiKey or x-api-key header, with full enhanced checks)
    const authResult = await validateApiKeyRequest(request, {
      include: { user: true },
      apiKeyOverride: apiKey,
    });
    if (!authResult.ok) return authResult.response;
    const key = authResult.apiKey;

    // ─── Guard Receipt Verification (Ed25519) ───
    const receiptB64 = request.headers.get("x-guard-receipt");
    const signatureB64 = request.headers.get("x-guard-receipt-sig");
    const hasReceipt = receiptB64 && signatureB64;

    if (REQUIRE_GUARD && !hasReceipt) {
      return NextResponse.json(
        { error: "Guard receipt required. All requests must go through the Guard reverse proxy." },
        { status: 403 }
      );
    }

    let guardVerified = false;

    if (hasReceipt) {
      const receipt = verifyGuardReceipt(receiptB64, signatureB64);
      if (!receipt) {
        return NextResponse.json(
          { error: "Invalid guard receipt. Signature verification failed, receipt expired, or replay detected." },
          { status: 403 }
        );
      }
      guardVerified = true;
    }

    const refCode = await generateUniqueRefCode();
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

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

        contentFlags: null,
        guardVerified,
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

    logAuditEvent({
      eventType: AuditEventTypes.HELP_REQUEST_SUBMITTED,
      userId: key.userId,
      apiKeyId: key.id,
      success: true,
      metadata: {
        requestId: helpRequest.id,
        refCode: helpRequest.refCode,
        apiKey: redactApiKey(apiKey),
        guardVerified,
      },
      request,
    });

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      expiresAt: helpRequest.expiresAt.toISOString(),
      ...(serverKeyPair && { serverPublicKey: serverKeyPair.publicKey }),
    });
  } catch (err) {
    console.error("Help request error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
