import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportUserData, getGdprSettings } from "@/lib/gdpr";

/**
 * POST /api/admin/gdpr/export — export user data (admin or self)
 * Body: { userId?: string } — omit to export own data
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetUserId = body.userId || user.id;

  // Non-admins can only export their own data
  if (targetUserId !== user.id) {
    const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (fullUser?.role !== "admin") {
      return NextResponse.json({ error: "Can only export your own data" }, { status: 403 });
    }
  }

  const settings = await getGdprSettings();
  if (settings.enabled && !settings.allowDataExport) {
    return NextResponse.json({ error: "Data export is disabled" }, { status: 403 });
  }

  // Record the data request
  await prisma.dataRequest.create({
    data: {
      userId: targetUserId,
      type: "export",
      status: "processing",
    },
  });

  const data = await exportUserData(targetUserId);
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Mark request as completed
  await prisma.dataRequest.updateMany({
    where: { userId: targetUserId, type: "export", status: "processing" },
    data: { status: "completed", processedAt: new Date() },
  });

  return NextResponse.json(data);
}
