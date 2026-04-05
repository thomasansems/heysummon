/**
 * Protocol wrapper for HeySummon API routes.
 *
 * Provides a higher-order function that consolidates common auth, validation,
 * error handling, and audit logging patterns across route handlers.
 *
 * Usage:
 *   export const POST = withProtocol(
 *     { requireAuth: true, authType: "any", auditEvent: "EXPERT_RESPONSE" },
 *     async (request, ctx) => {
 *       // ctx.callerRole, ctx.apiKey, ctx.expert available
 *       return NextResponse.json({ success: true });
 *     }
 *   );
 */

import { NextResponse } from "next/server";
import { validateApiKeyRequest, sanitizeError } from "./api-key-auth";
import { validateExpertKey } from "./expert-key-auth";
import { logAuditEvent, type AuditEventType } from "./audit";

export interface ProtocolContext {
  callerRole: "consumer" | "expert";
  /** Raw API key string */
  apiKeyValue?: string;
  /** API key record (for consumer keys) */
  apiKey?: { id: string; userId: string; expertId?: string | null };
  /** Expert profile (for expert keys) */
  expert?: { id: string; userId: string; name: string };
}

export interface ProtocolConfig {
  /** Whether authentication is required */
  requireAuth: boolean;
  /** Which key types are accepted */
  authType?: "consumer" | "expert" | "any";
  /** Audit event to log on success */
  auditEvent?: AuditEventType;
  /** Whether to check rate limits (consumer keys only) */
  rateLimit?: boolean;
}

type RouteHandler = (
  request: Request,
  ctx: ProtocolContext
) => Promise<NextResponse>;

/**
 * Wraps a route handler with protocol-level authentication, validation, and audit.
 *
 * NOT Next.js middleware (Edge runtime doesn't support Prisma).
 * This is function composition for Node.js route handlers.
 */
export function withProtocol(
  config: ProtocolConfig,
  handler: RouteHandler
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    try {
      let ctx: ProtocolContext | null = null;

      if (config.requireAuth) {
        const authType = config.authType ?? "any";

        // Try expert key first if allowed
        if (authType === "expert" || authType === "any") {
          const result = await validateExpertKey(request);
          if (result.ok) {
            ctx = {
              callerRole: "expert",
              expert: result.expert,
              apiKeyValue: request.headers.get("x-api-key") ?? undefined,
            };
          }
        }

        // Try consumer key if expert didn't match
        if (!ctx && (authType === "consumer" || authType === "any")) {
          const result = await validateApiKeyRequest(request);
          if (result.ok) {
            ctx = {
              callerRole: "consumer",
              apiKey: result.apiKey,
              apiKeyValue: request.headers.get("x-api-key") ?? undefined,
            };
          }
        }

        if (!ctx) {
          return NextResponse.json(
            { error: "Invalid or missing API key" },
            { status: 401 }
          );
        }
      } else {
        // No auth required — create empty context
        ctx = { callerRole: "consumer" };
      }

      // Execute the route handler
      const response = await handler(request, ctx);

      // Fire-and-forget audit on success
      if (config.auditEvent && response.status < 400) {
        logAuditEvent({
          eventType: config.auditEvent,
          userId: ctx.expert?.userId ?? ctx.apiKey?.userId ?? null,
          apiKeyId: ctx.apiKey?.id ?? null,
          success: true,
          request,
        });
      }

      return response;
    } catch (err) {
      console.error("Protocol error:", sanitizeError(err));
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }
  };
}
