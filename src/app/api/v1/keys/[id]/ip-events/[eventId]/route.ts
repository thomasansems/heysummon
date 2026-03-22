import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; eventId: string }> };

/** Verify the key belongs to the current user */
async function verifyOwnership(keyId: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const key = await prisma.apiKey.findFirst({
    where: { id: keyId, userId: user.id },
    select: { id: true },
  });
  return key ? user : null;
}

/**
 * PATCH /api/v1/keys/:id/ip-events/:eventId
 *
 * Update the status of a single IP event (e.g. "allowed" or "blacklisted").
 */
export async function PATCH(request: Request, { params }: Params) {
  const { id, eventId } = await params;
  const user = await verifyOwnership(id);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const { status } = body;

  if (!status || !["allowed", "pending", "blacklisted"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const event = await prisma.ipEvent.findFirst({
    where: { id: eventId, apiKeyId: id },
  });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.ipEvent.update({
    where: { id: eventId },
    data: { status },
  });

  // Sync allowedIps on the key from all "allowed" IP events
  const allowedEvents = await prisma.ipEvent.findMany({
    where: { apiKeyId: id, status: "allowed" },
    select: { ip: true },
  });
  await prisma.apiKey.update({
    where: { id },
    data: {
      allowedIps: allowedEvents.length > 0
        ? allowedEvents.map((e) => e.ip).join(",")
        : null,
    },
  });

  return NextResponse.json(updated);
}

/**
 * DELETE /api/v1/keys/:id/ip-events/:eventId
 *
 * Delete a single IP binding event.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id, eventId } = await params;
  const user = await verifyOwnership(id);
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const event = await prisma.ipEvent.findFirst({
    where: { id: eventId, apiKeyId: id },
  });

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.ipEvent.delete({ where: { id: eventId } });

  // Sync allowedIps on the key
  const allowedEvents = await prisma.ipEvent.findMany({
    where: { apiKeyId: id, status: "allowed" },
    select: { ip: true },
  });
  await prisma.apiKey.update({
    where: { id },
    data: {
      allowedIps: allowedEvents.length > 0
        ? allowedEvents.map((e) => e.ip).join(",")
        : null,
    },
  });

  return NextResponse.json({ ok: true });
}
