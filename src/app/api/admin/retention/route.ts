export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runCleanup } from "@/lib/retention";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/retention — get current retention stats
 * POST /api/admin/retention — trigger manual cleanup
 */

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const retentionDays = process.env.HEYSUMMON_RETENTION_DAYS
    ? parseInt(process.env.HEYSUMMON_RETENTION_DAYS, 10)
    : null;

  const [totalRequests, expiredRequests, totalAuditLogs] = await Promise.all([
    prisma.helpRequest.count(),
    prisma.helpRequest.count({ where: { status: { in: ["expired", "closed"] } } }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({
    retentionDays,
    enabled: !!retentionDays,
    stats: {
      totalRequests,
      expiredRequests,
      totalAuditLogs,
    },
  });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await runCleanup();
  return NextResponse.json({ ok: true, message: "Cleanup triggered" });
}
