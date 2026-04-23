export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { messageCreateSchema, validateBody, requireJsonContentType } from "@/lib/validations";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import { checkContentSafety } from "@/lib/content-safety-middleware";

/**
 * POST /api/v1/message/:requestId — Send a message (encrypted or plaintext)
 *
 * Authentication: x-api-key header required.
 *   - Expert key (hs_exp_*) → can send as "expert"
 *   - Client key (hs_cli_*)  → can send as "consumer"
 *
 * The API validates that the key has access to this specific request.
 *
 * Required: from ("consumer"|"expert"), + either plaintext or encrypted fields
 * Returns: { success: true, messageId }
 *
 * 409 with code "NO_RESPONSE_REQUIRED" if the request is notification-mode
 * (responseRequired=false) — notifications do not accept messages.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

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
    let callerRole: "expert" | "consumer" | null = null;

    // Check expert key
    const expert = await prisma.userProfile.findFirst({
      where: { key: apiKey, isActive: true },
      select: { id: true, userId: true },
    });

    if (expert) {
      // Verify this expert owns the request
      const helpRequest = await prisma.helpRequest.findFirst({
        where: { id: requestId, expertId: expert.userId },
      });
      if (!helpRequest) {
        return NextResponse.json(
          { error: "Request not found or not assigned to this expert" },
          { status: 403 }
        );
      }
      callerRole = "expert";
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
      // Run content safety on plaintext messages from consumers
      let safeText = plaintext;
      if (from === "consumer") {
        const safetyCheck = checkContentSafety({ plaintext });
        if (!safetyCheck.passed) {
          return safetyCheck.response;
        }
        safeText = safetyCheck.sanitizedText || plaintext;
      }

      const crypto = await import("node:crypto");
      ciphertext = Buffer.from(safeText).toString("base64");
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

    if (helpRequest.responseRequired === false) {
      return NextResponse.json(
        {
          error: "This request is notification-mode; messages are not accepted",
          code: "NO_RESPONSE_REQUIRED",
        },
        { status: 409 }
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
      if (from === "expert" && (!helpRequest.expertSignPubKey || !helpRequest.expertEncryptPubKey)) {
        return NextResponse.json(
          { error: "Expert must exchange keys first (POST /key-exchange)" },
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

    // Handle approvalDecision if present (approve/deny flow)
    const approvalDecision = (raw as Record<string, unknown>).approvalDecision;
    const isApprovalResponse =
      from === "expert" &&
      (approvalDecision === "approved" || approvalDecision === "denied");

    // Update status to responded when expert sends a message
    if (from === "expert" && helpRequest.status !== "responded") {
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: {
          status: "responded",
          respondedAt: new Date(),
          ...(isApprovalResponse ? { approvalDecision: approvalDecision as string } : {}),
        },
      });
    } else if (isApprovalResponse && !helpRequest.approvalDecision) {
      // Update approvalDecision even if already responded
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: { approvalDecision: approvalDecision as string },
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

    // Log audit event for expert responses
    if (from === "expert") {
      logAuditEvent({
        eventType: AuditEventTypes.EXPERT_RESPONSE,
        success: true,
        metadata: { requestId, refCode: helpRequest.refCode, via: "api" },
        request,
      });
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
