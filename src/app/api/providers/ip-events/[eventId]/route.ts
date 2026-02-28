import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/providers/ip-events/:eventId — Update IP event status (allow/blacklist)
 * DELETE /api/providers/ip-events/:eventId — Delete an IP event
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await request.json();
  const { status } = body;

  if (!["allowed", "pending", "blacklisted"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Verify the event belongs to a profile owned by this user
  const event = await prisma.ipEvent.findUnique({
    where: { id: eventId },
    include: { profile: { select: { userId: true } } },
  });

  if (!event || !event.profile || event.profile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.ipEvent.update({
    where: { id: eventId },
    data: { status, attempts: status === "allowed" ? 0 : undefined },
  });

  return NextResponse.json({ event: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { eventId } = await params;

  const event = await prisma.ipEvent.findUnique({
    where: { id: eventId },
    include: { profile: { select: { userId: true } } },
  });

  if (!event || !event.profile || event.profile.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.ipEvent.delete({ where: { id: eventId } });
  return NextResponse.json({ ok: true });
}
