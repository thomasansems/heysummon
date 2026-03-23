import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateGdprCache } from "@/lib/gdpr";

/**
 * GET /api/admin/gdpr — get GDPR settings
 * PUT /api/admin/gdpr — update GDPR settings
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settings = await prisma.gdprSettings.findUnique({
    where: { id: "singleton" },
  });

  return NextResponse.json(
    settings ?? {
      id: "singleton",
      enabled: false,
      anonymizeIps: true,
      retentionDays: 90,
      requireConsent: true,
      allowDataExport: true,
      allowDataDeletion: true,
      privacyPolicyUrl: null,
    }
  );
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Only admins can change GDPR settings
  const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (fullUser?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const {
    enabled,
    anonymizeIps,
    retentionDays,
    requireConsent,
    allowDataExport,
    allowDataDeletion,
    privacyPolicyUrl,
  } = body;

  const settings = await prisma.gdprSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      enabled: enabled ?? false,
      anonymizeIps: anonymizeIps ?? true,
      retentionDays: retentionDays ?? 90,
      requireConsent: requireConsent ?? true,
      allowDataExport: allowDataExport ?? true,
      allowDataDeletion: allowDataDeletion ?? true,
      privacyPolicyUrl: privacyPolicyUrl ?? null,
    },
    update: {
      ...(typeof enabled === "boolean" ? { enabled } : {}),
      ...(typeof anonymizeIps === "boolean" ? { anonymizeIps } : {}),
      ...(typeof retentionDays === "number" ? { retentionDays: Math.max(1, Math.min(3650, retentionDays)) } : {}),
      ...(typeof requireConsent === "boolean" ? { requireConsent } : {}),
      ...(typeof allowDataExport === "boolean" ? { allowDataExport } : {}),
      ...(typeof allowDataDeletion === "boolean" ? { allowDataDeletion } : {}),
      ...(privacyPolicyUrl !== undefined ? { privacyPolicyUrl: privacyPolicyUrl || null } : {}),
    },
  });

  invalidateGdprCache();

  return NextResponse.json(settings);
}
