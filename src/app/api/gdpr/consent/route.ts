import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGdprSettings, anonymizeIp } from "@/lib/gdpr";

const VALID_CONSENT_TYPES = ["data_processing", "communications", "analytics"] as const;

/**
 * GET /api/gdpr/consent — get current user's consent status
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const consents = await prisma.userConsent.findMany({
    where: { userId: user.id },
  });

  const settings = await getGdprSettings();

  return NextResponse.json({
    gdprEnabled: settings.enabled,
    requireConsent: settings.requireConsent,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    consents: VALID_CONSENT_TYPES.map((type) => {
      const existing = consents.find((c) => c.consentType === type);
      return {
        type,
        granted: existing?.granted ?? false,
        grantedAt: existing?.grantedAt ?? null,
        revokedAt: existing?.revokedAt ?? null,
      };
    }),
  });
}

/**
 * PUT /api/gdpr/consent — update consent (opt-in / opt-out)
 * Body: { consentType: string, granted: boolean }
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { consentType, granted } = body;

  if (!VALID_CONSENT_TYPES.includes(consentType)) {
    return NextResponse.json(
      { error: `Invalid consent type. Must be one of: ${VALID_CONSENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (typeof granted !== "boolean") {
    return NextResponse.json({ error: "granted must be a boolean" }, { status: 400 });
  }

  const settings = await getGdprSettings();
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") || null;
  const processedIp = settings.enabled && settings.anonymizeIps && clientIp
    ? anonymizeIp(clientIp)
    : clientIp;

  const consent = await prisma.userConsent.upsert({
    where: {
      userId_consentType: { userId: user.id, consentType },
    },
    create: {
      userId: user.id,
      consentType,
      granted,
      ipAddress: processedIp,
      userAgent: request.headers.get("user-agent"),
      grantedAt: granted ? new Date() : null,
    },
    update: {
      granted,
      ipAddress: processedIp,
      userAgent: request.headers.get("user-agent"),
      ...(granted
        ? { grantedAt: new Date(), revokedAt: null }
        : { revokedAt: new Date() }),
    },
  });

  return NextResponse.json(consent);
}
