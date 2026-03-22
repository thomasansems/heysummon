export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  parseGatherResult,
  generateThankYouTwiml,
  generateNoInputTwiml,
  getPhoneFirstConfig,
} from "@/lib/adapters/twilio-voice";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/integrations/twilio/voice/:requestId/gather
 *
 * Twilio calls this URL after gathering speech/DTMF input from the provider.
 * Processes the response, stores it, and returns a thank-you TwiML.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  // Parse Twilio's form-encoded body
  const formData = await request.formData();
  const speechResult = formData.get("SpeechResult") as string | null;
  const digits = formData.get("Digits") as string | null;
  const callSid = formData.get("CallSid") as string | null;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      requiresApproval: true,
      apiKey: { select: { providerId: true } },
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

  // Parse the provider's response
  const result = parseGatherResult(speechResult, digits);

  // Store the phone response
  const updateData: Record<string, unknown> = {
    phoneCallStatus: "completed",
    phoneCallResponse: result.response,
  };

  // If approval workflow: set approval decision
  if (helpRequest.requiresApproval && (result.type === "approve" || result.type === "deny")) {
    updateData.approvalDecision = result.type === "approve" ? "approved" : "denied";
  }

  // If text response, transition to responded
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
    eventType: AuditEventTypes.PROVIDER_RESPONSE,
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

  // Get language for TTS
  let language = "en-US";
  if (helpRequest.apiKey.providerId) {
    const config = await getPhoneFirstConfig(helpRequest.apiKey.providerId);
    if (config?.providerConfig.voiceLanguage) {
      language = config.providerConfig.voiceLanguage;
    }
  }

  return new NextResponse(generateThankYouTwiml(language), {
    headers: { "Content-Type": "application/xml" },
  });
}
