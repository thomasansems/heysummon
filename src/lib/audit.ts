import { prisma } from "./prisma";
import { maybeAnonymizeIp } from "./gdpr";

export const AuditEventTypes = {
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  ACCOUNT_CREATED: "ACCOUNT_CREATED",
  ACCOUNT_UPDATED: "ACCOUNT_UPDATED",
  ACCOUNT_DELETED: "ACCOUNT_DELETED",
  API_KEY_CREATED: "API_KEY_CREATED",
  API_KEY_ROTATED: "API_KEY_ROTATED",
  API_KEY_DELETED: "API_KEY_DELETED",
  KEY_EXCHANGE: "KEY_EXCHANGE",
  PERMISSION_CHANGED: "PERMISSION_CHANGED",
  HELP_REQUEST_SUBMITTED: "HELP_REQUEST_SUBMITTED",
  PROVIDER_RESPONSE: "PROVIDER_RESPONSE",
  NOTIFICATION_DELIVERED: "NOTIFICATION_DELIVERED",
  NOTIFICATION_RESENT: "NOTIFICATION_RESENT",
  CONSUMER_CONNECTED: "CONSUMER_CONNECTED",
  SETUP_VERIFIED: "SETUP_VERIFIED",
  GDPR_SETTINGS_UPDATED: "GDPR_SETTINGS_UPDATED",
  GDPR_DATA_EXPORTED: "GDPR_DATA_EXPORTED",
  GDPR_DATA_DELETED: "GDPR_DATA_DELETED",
  GDPR_CONSENT_UPDATED: "GDPR_CONSENT_UPDATED",
} as const;

export type AuditEventType = (typeof AuditEventTypes)[keyof typeof AuditEventTypes];

export interface AuditEventDetails {
  eventType: AuditEventType;
  userId?: string | null;
  apiKeyId?: string | null;
  success?: boolean;
  metadata?: Record<string, unknown>;
  request?: Request | { headers: Headers };
}

function extractIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") || null;
}

function extractUserAgent(headers: Headers): string | null {
  return headers.get("user-agent") || null;
}

/** Redact sensitive data — API keys show only last 4 chars */
export function redactApiKey(key: string): string {
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

/**
 * Redact any sensitive fields in metadata before logging.
 * Removes full API keys, passwords, tokens, secrets.
 */
function redactMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...metadata };
  const sensitiveKeys = ["password", "secret", "token", "deviceSecret"];

  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    }
    if (key === "apiKey" && typeof redacted[key] === "string") {
      redacted[key] = redactApiKey(redacted[key] as string);
    }
  }

  return redacted;
}

/**
 * Log an audit event. Fire-and-forget — never throws to avoid breaking the request flow.
 */
export async function logAuditEvent(details: AuditEventDetails): Promise<void> {
  try {
    const headers = details.request?.headers;
    const rawIp = headers ? extractIp(headers) : null;
    const ip = await maybeAnonymizeIp(rawIp);
    const userAgent = headers ? extractUserAgent(headers) : null;
    const metadata = details.metadata ? redactMetadata(details.metadata) : null;

    await prisma.auditLog.create({
      data: {
        eventType: details.eventType,
        userId: details.userId || null,
        apiKeyId: details.apiKeyId || null,
        ip,
        userAgent,
        metadata: metadata ? JSON.stringify(metadata) : null,
        success: details.success ?? true,
      },
    });
  } catch (err) {
    console.error("[Audit] Failed to log event:", err);
  }
}
