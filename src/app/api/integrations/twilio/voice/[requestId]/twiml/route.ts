export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCallTwiml, generateNoInputTwiml, getPhoneFirstConfig } from "@/lib/adapters/twilio-voice";

/**
 * POST /api/integrations/twilio/voice/:requestId/twiml
 *
 * Twilio fetches this URL when the call connects.
 * Returns TwiML that reads the question and gathers the provider's response.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      questionPreview: true,
      question: true,
      refCode: true,
      apiKey: {
        select: { providerId: true },
      },
    },
  });

  if (!helpRequest) {
    return new NextResponse(generateNoInputTwiml(), {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // Use questionPreview (plaintext) for TTS — question field may be encrypted
  const questionText = helpRequest.questionPreview || "A new help request has been submitted. Please check your dashboard for details.";

  // Get language from provider config
  let language = "en-US";
  if (helpRequest.apiKey.providerId) {
    const config = await getPhoneFirstConfig(helpRequest.apiKey.providerId);
    if (config?.providerConfig.voiceLanguage) {
      language = config.providerConfig.voiceLanguage;
    }
  }

  const twiml = generateCallTwiml(requestId, questionText, language);

  return new NextResponse(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
}
