export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generateCallTwiml,
  generateNoInputTwiml,
  validateTwilioWebhook,
  parseFormParams,
} from "@/lib/adapters/twilio-voice";

const DEBUG = process.env.DEBUG === "true";

/**
 * POST /api/integrations/twilio/voice/:requestId/twiml
 *
 * Twilio fetches this URL when the call connects.
 * Returns TwiML that reads the question and gathers the provider's response.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  // Parse form data once — used for both signature validation and business logic
  const formData = await request.formData();
  const formParams = parseFormParams(formData);

  // Validate Twilio webhook signature
  const path = `/api/integrations/twilio/voice/${requestId}/twiml`;
  const validation = await validateTwilioWebhook(request, requestId, formParams, path);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 403 });
  }

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      questionPreview: true,
      question: true,
      refCode: true,
    },
  });

  if (!helpRequest) {
    return new NextResponse(generateNoInputTwiml(), {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // Use questionPreview (plaintext) for TTS — question field may be encrypted
  const questionText = helpRequest.questionPreview || "A new help request has been submitted. Please check your dashboard for details.";

  const twiml = generateCallTwiml(requestId, questionText);

  if (DEBUG) {
    console.log(`[twilio/twiml] requestId=${requestId} refCode=${helpRequest.refCode}`);
    console.log(`[twilio/twiml] questionText="${questionText}"`);
    console.log(`[twilio/twiml] generated TwiML:\n${twiml}`);
  }

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}
