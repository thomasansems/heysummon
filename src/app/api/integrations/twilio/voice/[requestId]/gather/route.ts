export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEBUG = process.env.DEBUG === "true";
import {
  parseGatherResult,
  generateThankYouTwiml,
  generateNoInputTwiml,
  validateTwilioWebhook,
  parseFormParams,
} from "@/lib/adapters/twilio-voice";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/integrations/twilio/voice/:requestId/gather
 *
 * Twilio calls this URL after gathering speech/DTMF input from the expert.
 * Processes the response, stores it, and returns a thank-you TwiML.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  // Parse Twilio's form-encoded body
  const formData = await request.formData();
  const formParams = parseFormParams(formData);

  // Validate Twilio webhook signature
  const path = `/api/integrations/twilio/voice/${requestId}/gather`;
  const validation = await validateTwilioWebhook(request, requestId, formParams, path);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 403 });
  }

  const speechResult = formParams["SpeechResult"] || null;
  const digits = formParams["Digits"] || null;
  const callSid = formParams["CallSid"] || null;

  if (DEBUG) {
    console.log(`[twilio/gather] requestId=${requestId}`, JSON.stringify(formParams, null, 2));
    console.log(`[twilio/gather] SpeechResult="${speechResult}" Digits="${digits}" CallSid=${callSid}`);
  }

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      requiresApproval: true,
    },
  });

  if (!helpRequest) {
    return new NextResponse(generateNoInputTwiml(), {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // No input received
  if (!speechResult && !digits) {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { phoneCallStatus: "no-answer" },
    });
    return new NextResponse(generateNoInputTwiml(), {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // Parse the expert's response
  const result = parseGatherResult(speechResult, digits);

  if (DEBUG) {
    console.log(`[twilio/gather] parsed response: type="${result.type}" text="${result.response}"`);
  }

  // Store the phone response
  const updateData: Record<string, unknown> = {
    phoneCallStatus: "completed",
    phoneCallResponse: result.response,
  };

  // If approval workflow: set approval decision
  if (helpRequest.requiresApproval && (result.type === "approve" || result.type === "deny")) {
    updateData.approvalDecision = result.type === "approve" ? "approved" : "denied";
    updateData.status = "responded";
    updateData.respondedAt = new Date();
    updateData.response = result.response;
  }

  // If text response or non-approval workflow, transition to responded
  if (result.type === "text" || !helpRequest.requiresApproval) {
    updateData.status = "responded";
    updateData.respondedAt = new Date();
    updateData.response = result.response;
  }

  await prisma.helpRequest.update({
    where: { id: requestId },
    data: updateData,
  });

  // Audit log
  logAuditEvent({
    eventType: AuditEventTypes.EXPERT_RESPONSE,
    userId: null,
    success: true,
    metadata: {
      requestId,
      responseType: result.type,
      responseText: result.response,
      callSid,
      via: "twilio-voice",
    },
  });

  return new NextResponse(generateThankYouTwiml(), {
    headers: { "Content-Type": "application/xml" },
  });
}
