export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { generateUniqueRefCode } from "@/lib/refcode";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import { getAdapter } from "@/lib/channels";
import type { TelegramConfig, SlackConfig, OpenClawConfig } from "@/lib/adapters/types";

type ErrorCode =
  | "auth"
  | "expert_disabled"
  | "no_channel"
  | "encryption_unconfigured"
  | "internal";

const ERROR_STATUS: Record<ErrorCode, number> = {
  auth: 401,
  expert_disabled: 404,
  no_channel: 422,
  encryption_unconfigured: 422,
  internal: 500,
};

function errorResponse(code: ErrorCode, message: string) {
  return NextResponse.json(
    { ok: false, code, error: message },
    { status: ERROR_STATUS[code] },
  );
}

/**
 * Heuristic: does this channel row have the minimum config the adapter
 * needs to dispatch a real notification? Used so verify-roundtrip can
 * surface the difference between "no channel exists" and "channel exists
 * but is missing required cryptographic / transport material".
 */
function isChannelDispatchable(type: string, configJson: string): boolean {
  let cfg: unknown;
  try {
    cfg = JSON.parse(configJson || "{}");
  } catch {
    return false;
  }
  const c = cfg as Record<string, unknown>;
  switch (type) {
    case "telegram": {
      const t = c as Partial<TelegramConfig>;
      return Boolean(t.botToken && t.expertChatId);
    }
    case "slack": {
      const s = c as Partial<SlackConfig>;
      return Boolean(s.botToken && s.channelId);
    }
    case "openclaw": {
      const o = c as Partial<OpenClawConfig>;
      return Boolean(o.webhookUrl && o.apiKey);
    }
    default:
      // Unknown / soon-to-be-supported channels: trust the row's isActive flag.
      return true;
  }
}

/**
 * POST /api/v1/setup/verify-roundtrip
 *
 * Auth: x-api-key (consumer / client key, hs_cli_*).
 *
 * Verifies that a freshly-installed client can reach a real notification
 * channel for the expert linked to its API key. Creates a synthetic
 * `probe: true` HelpRequest row, runs channel resolution to confirm at
 * least one active channel is dispatchable, then immediately closes the
 * row. **Never dispatches Telegram/Slack/OpenClaw fan-out** — the row is
 * filtered out of every dashboard / events / search query via
 * `src/lib/help-request-scope.ts`.
 *
 * Response shape:
 *   200 { ok: true, expertName, channelType }
 *   401 { ok: false, code: "auth", error }
 *   404 { ok: false, code: "expert_disabled", error }
 *   422 { ok: false, code: "no_channel" | "encryption_unconfigured", error }
 *   500 { ok: false, code: "internal", error }
 */
export async function POST(request: Request) {
  let auth: Awaited<ReturnType<typeof validateApiKeyRequest>>;
  try {
    auth = await validateApiKeyRequest(request);
  } catch (err) {
    console.error("[verify-roundtrip] auth threw:", err);
    return errorResponse("internal", "Authentication check failed.");
  }
  if (!auth.ok) {
    // validateApiKeyRequest returns its own NextResponse for richer auth
    // failures (rate limit, IP not allowed, etc.). Normalise the most
    // common 401 path to the documented `code: "auth"` shape so the
    // install script can branch on it; otherwise pass the response
    // through unchanged.
    if (auth.response.status === 401) {
      return errorResponse("auth", "API key is invalid, expired, or inactive.");
    }
    return auth.response;
  }
  const key = auth.apiKey;

  try {
    // ─── Resolve expert profile linked to this client key ───
    const profile = key.expertId
      ? await prisma.userProfile.findUnique({
          where: { id: key.expertId },
          select: { id: true, name: true, isActive: true, userId: true },
        })
      : await prisma.userProfile.findFirst({
          where: { userId: key.userId, isActive: true },
          select: { id: true, name: true, isActive: true, userId: true },
        });

    if (!profile) {
      return errorResponse(
        "expert_disabled",
        "Expert profile is missing — contact admin.",
      );
    }
    if (!profile.isActive) {
      return errorResponse(
        "expert_disabled",
        "Expert account is currently disabled.",
      );
    }

    // ─── Channel resolution (no fan-out) ───
    const channels = await prisma.expertChannel.findMany({
      where: { profileId: profile.id, isActive: true },
      select: { id: true, type: true, config: true, status: true },
    });

    if (channels.length === 0) {
      return errorResponse(
        "no_channel",
        "Expert has no active notification channel. Add one in the dashboard before installing.",
      );
    }

    const dispatchable = channels.find((c) =>
      isChannelDispatchable(c.type, c.config ?? "{}"),
    );

    if (!dispatchable) {
      return errorResponse(
        "encryption_unconfigured",
        "Expert has channels but none are fully configured (missing tokens or transport secrets).",
      );
    }

    // ─── Create probe HelpRequest (status closed, no fan-out) ───
    const refCode = await generateUniqueRefCode();
    const now = new Date();
    const probe = await prisma.helpRequest.create({
      data: {
        refCode,
        apiKeyId: key.id,
        expertId: profile.userId,
        probe: true,
        status: "closed",
        responseRequired: false,
        guardVerified: true,
        notifiedExpertAt: null,
        expiresAt: new Date(now.getTime() + 60_000),
        closedAt: now,
      },
      select: { id: true, refCode: true },
    });

    // Adapter resolution sanity check — proves we *could* have dispatched.
    // We deliberately do NOT call the adapter; we only confirm one is
    // wired up for the channel type.
    const adapterPresent = Boolean(getAdapter(dispatchable.type));

    logAuditEvent({
      eventType: AuditEventTypes.SETUP_VERIFIED,
      userId: profile.userId,
      apiKeyId: key.id,
      success: true,
      metadata: {
        probeRequestId: probe.id,
        refCode: probe.refCode,
        channelType: dispatchable.type,
        adapterPresent,
      },
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      expertName: profile.name,
      channelType: dispatchable.type,
    });
  } catch (err) {
    console.error("[verify-roundtrip] failed:", err);
    return errorResponse(
      "internal",
      "Server error while verifying round-trip.",
    );
  }
}
