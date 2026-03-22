import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteUserData, getGdprSettings } from "@/lib/gdpr";

/**
 * POST /api/admin/gdpr/delete — delete user data (admin only, or self-deletion)
 * Body: { userId: string, confirm: true }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const { userId: targetUserId, confirm } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  if (!confirm) {
    return NextResponse.json({ error: "Must confirm deletion with confirm: true" }, { status: 400 });
  }

  // Non-admins can only delete their own data
  if (targetUserId !== user.id) {
    const fullUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
    if (fullUser?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required to delete other users" }, { status: 403 });
    }
  }

  const settings = await getGdprSettings();
  if (settings.enabled && !settings.allowDataDeletion) {
    return NextResponse.json({ error: "Data deletion is disabled" }, { status: 403 });
  }

  // Record the data request before deletion
  await prisma.dataRequest.create({
    data: {
      userId: targetUserId,
      type: "deletion",
      status: "processing",
    },
  });

  const result = await deleteUserData(targetUserId);
  if (!result) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
