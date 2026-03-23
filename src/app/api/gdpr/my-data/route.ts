import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportUserData, getGdprSettings } from "@/lib/gdpr";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/gdpr/my-data — export own data (user-facing, no admin required)
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const settings = await getGdprSettings();
  if (settings.enabled && !settings.allowDataExport) {
    return NextResponse.json({ error: "Data export is currently disabled" }, { status: 403 });
  }

  // Record the export request
  await prisma.dataRequest.create({
    data: {
      userId: user.id,
      type: "export",
      status: "processing",
    },
  });

  const data = await exportUserData(user.id);
  if (!data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Mark as completed
  await prisma.dataRequest.updateMany({
    where: { userId: user.id, type: "export", status: "processing" },
    data: { status: "completed", processedAt: new Date() },
  });

  return NextResponse.json(data);
}
