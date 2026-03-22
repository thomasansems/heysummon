/**
 * Twilio Voice adapter for phone-first provider notifications.
 *
 * Flow:
 *  1. Client submits a help request
 *  2. If provider has phoneFirst enabled, initiate a Twilio voice call
 *  3. Twilio calls the provider's phone number
 *  4. TwiML reads the question text via text-to-speech
 *  5. Provider responds verbally or presses keys to approve/deny
 *  6. Twilio sends the response back via status callback webhook
 *  7. If no answer / timeout → fall back to chat channel
 */

import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";
import twilio from "twilio";

export interface TwilioVoiceSystemConfig {
  accountSid: string;
  authToken: string;
}

export interface TwilioVoiceProviderConfig {
  phoneNumber: string; // Provider's phone number to call (E.164 format)
  twilioPhoneNumber: string; // Twilio phone number to call FROM (E.164 format)
  voiceLanguage?: string; // e.g. "en-US", "nl-NL"
}

/**
 * Validate the system-level Twilio config (account SID + auth token).
 */
export function validateSystemConfig(
  config: unknown
): { valid: true; config: TwilioVoiceSystemConfig } | { valid: false; error: string } {
  if (!config || typeof config !== "object") {
    return { valid: false, error: "Config is required" };
  }
  const c = config as Record<string, unknown>;
  if (!c.accountSid || typeof c.accountSid !== "string" || !c.accountSid.startsWith("AC")) {
    return { valid: false, error: "Valid Twilio Account SID is required (starts with AC)" };
  }
  if (!c.authToken || typeof c.authToken !== "string" || c.authToken.length < 20) {
    return { valid: false, error: "Valid Twilio Auth Token is required" };
  }
  return {
    valid: true,
    config: {
      accountSid: c.accountSid.trim(),
      authToken: c.authToken.trim(),
    },
  };
}

/**
 * Validate provider-level Twilio config (phone numbers).
 */
export function validateProviderConfig(
  config: unknown
): { valid: true; config: TwilioVoiceProviderConfig } | { valid: false; error: string } {
  if (!config || typeof config !== "object") {
    return { valid: false, error: "Config is required" };
  }
  const c = config as Record<string, unknown>;
  if (!c.phoneNumber || typeof c.phoneNumber !== "string") {
    return { valid: false, error: "Provider phone number is required" };
  }
  if (!c.twilioPhoneNumber || typeof c.twilioPhoneNumber !== "string") {
    return { valid: false, error: "Twilio phone number (FROM) is required" };
  }
  // Basic E.164 validation
  const phoneRegex = /^\+[1-9]\d{6,14}$/;
  if (!phoneRegex.test(c.phoneNumber.trim())) {
    return { valid: false, error: "Provider phone number must be in E.164 format (e.g. +31612345678)" };
  }
  if (!phoneRegex.test(c.twilioPhoneNumber.trim())) {
    return { valid: false, error: "Twilio phone number must be in E.164 format (e.g. +15551234567)" };
  }
  return {
    valid: true,
    config: {
      phoneNumber: c.phoneNumber.trim(),
      twilioPhoneNumber: c.twilioPhoneNumber.trim(),
      voiceLanguage: typeof c.voiceLanguage === "string" ? c.voiceLanguage.trim() : "en-US",
    },
  };
}

/**
 * Verify Twilio credentials by fetching the account info.
 */
export async function verifyTwilioCredentials(
  accountSid: string,
  authToken: string
): Promise<{ valid: true } | { valid: false; error: string }> {
  try {
    const client = twilio(accountSid, authToken);
    const account = await client.api.accounts(accountSid).fetch();
    if (account.status !== "active") {
      return { valid: false, error: `Twilio account is ${account.status}, expected active` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "Could not verify Twilio credentials. Check Account SID and Auth Token." };
  }
}

/**
 * Initiate a phone call to the provider for a help request.
 *
 * Returns the Twilio Call SID or null if the call could not be placed.
 */
export async function initiateProviderCall(
  requestId: string,
  questionText: string,
  systemConfig: TwilioVoiceSystemConfig,
  providerConfig: TwilioVoiceProviderConfig,
  timeoutSeconds: number = 30
): Promise<{ callSid: string } | { error: string }> {
  try {
    const client = twilio(systemConfig.accountSid, systemConfig.authToken);
    const baseUrl = getPublicBaseUrl();
    const language = providerConfig.voiceLanguage || "en-US";

    // TwiML URL: Twilio will fetch this to get instructions for the call
    const twimlUrl = `${baseUrl}/api/integrations/twilio/voice/${requestId}/twiml`;
    // Status callback: Twilio calls this when call status changes
    const statusCallback = `${baseUrl}/api/integrations/twilio/voice/${requestId}/status`;

    const call = await client.calls.create({
      to: providerConfig.phoneNumber,
      from: providerConfig.twilioPhoneNumber,
      url: twimlUrl,
      statusCallback,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      statusCallbackMethod: "POST",
      timeout: timeoutSeconds,
      machineDetection: "Enable",
    });

    // Track the call in the database
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        phoneCallSid: call.sid,
        phoneCallStatus: "initiated",
        phoneCallAt: new Date(),
      },
    });

    return { callSid: call.sid };
  } catch (err) {
    console.error("[twilio-voice] Failed to initiate call:", err);
    return { error: err instanceof Error ? err.message : "Failed to initiate call" };
  }
}

/**
 * Generate TwiML for the provider call.
 * Reads the question, then gathers speech/DTMF input.
 */
export function generateCallTwiml(
  requestId: string,
  questionText: string,
  language: string = "en-US"
): string {
  const baseUrl = getPublicBaseUrl();
  const gatherUrl = `${baseUrl}/api/integrations/twilio/voice/${requestId}/gather`;

  // Escape XML special characters in question text
  const escapedQuestion = questionText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${language}">You have a new help request from Hey Summon.</Say>
  <Pause length="1"/>
  <Say language="${language}">The question is: ${escapedQuestion}</Say>
  <Pause length="1"/>
  <Gather input="speech dtmf" timeout="15" speechTimeout="auto" action="${gatherUrl}" method="POST" language="${language}">
    <Say language="${language}">Please speak your response, or press 1 to approve, or press 2 to deny. You can also provide a detailed spoken response.</Say>
  </Gather>
  <Say language="${language}">I did not receive a response. The request will be routed to your chat channel. Goodbye.</Say>
</Response>`;
}

/**
 * Generate TwiML for after the provider gives a response.
 */
export function generateThankYouTwiml(language: string = "en-US"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${language}">Thank you. Your response has been collected and will be sent to the client. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Generate TwiML for when no input was received.
 */
export function generateNoInputTwiml(language: string = "en-US"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${language}">No response was received. The request will be forwarded to your chat channel. Goodbye.</Say>
  <Hangup/>
</Response>`;
}

/**
 * Parse gather results from Twilio into a response string.
 */
export function parseGatherResult(
  speechResult: string | null,
  digits: string | null
): { response: string; type: "approve" | "deny" | "text" } {
  // DTMF: 1 = approve, 2 = deny
  if (digits === "1") {
    return { response: "approved", type: "approve" };
  }
  if (digits === "2") {
    return { response: "denied", type: "deny" };
  }

  // Speech result
  if (speechResult) {
    const lower = speechResult.toLowerCase().trim();
    // Check for approval/denial keywords
    if (
      lower === "approve" ||
      lower === "approved" ||
      lower === "yes" ||
      lower === "accept" ||
      lower === "ok" ||
      lower === "okay"
    ) {
      return { response: "approved", type: "approve" };
    }
    if (
      lower === "deny" ||
      lower === "denied" ||
      lower === "no" ||
      lower === "reject" ||
      lower === "decline"
    ) {
      return { response: "denied", type: "deny" };
    }
    // Free-form text response
    return { response: speechResult, type: "text" };
  }

  return { response: "", type: "text" };
}

/**
 * Look up the Twilio system config and provider config for a given provider profile.
 * Returns null if phone-first is not configured.
 */
export async function getPhoneFirstConfig(profileId: string): Promise<{
  systemConfig: TwilioVoiceSystemConfig;
  providerConfig: TwilioVoiceProviderConfig;
  timeout: number;
} | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    select: {
      phoneFirst: true,
      phoneFirstIntegrationId: true,
      phoneFirstTimeout: true,
      integrationConfigs: {
        include: { integration: true },
      },
    },
  });

  if (!profile?.phoneFirst || !profile.phoneFirstIntegrationId) {
    return null;
  }

  // Find the matching provider integration config
  const providerIntConfig = profile.integrationConfigs.find(
    (c) => c.integrationId === profile.phoneFirstIntegrationId && c.isActive
  );
  if (!providerIntConfig) return null;

  // Get the system-level integration
  const integration = providerIntConfig.integration;
  if (!integration.isActive || integration.category !== "voice") return null;

  const sysResult = validateSystemConfig(JSON.parse(integration.config));
  if (!sysResult.valid) return null;

  const provResult = validateProviderConfig(JSON.parse(providerIntConfig.config));
  if (!provResult.valid) return null;

  return {
    systemConfig: sysResult.config,
    providerConfig: provResult.config,
    timeout: profile.phoneFirstTimeout,
  };
}
