import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/keys/:id/ip-events/reset
 *
 * Deletes all IP binding events for a client key, allowing re-binding from a new device.
 * Auth: dashboard user (must own the key)
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the key belongs to this user
  const key = await prisma.apiKey.findFirst({
    where: { id, userId: user.id },
    select: { id: true, allowedIps: true },
  });

  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete all IP events for this key
  await prisma.ipEvent.deleteMany({
    where: { apiKeyId: id },
  });

  // Clear the allowed IPs on the key itself
  await prisma.apiKey.update({
    where: { id },
    data: { allowedIps: null },
  });

  return NextResponse.json({ ok: true });
}
