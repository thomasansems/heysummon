import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelUpdateSchema, validateBody } from "@/lib/validations";

type Params = { params: Promise<{ id: string; channelId: string }> };

/** Helper: verify ownership chain user → provider → channel */
async function getOwnedChannel(userId: string, providerId: string, channelId: string) {
  const provider = await prisma.provider.findUnique({ where: { id: providerId } });
  if (!provider || provider.userId !== userId) return null;

  const channel = await prisma.providerChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.providerId !== providerId) return null;

  return channel;
}

/** PATCH /api/providers/[id]/channels/[channelId] — update a channel */
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, channelId } = await params;
  const channel = await getOwnedChannel(user.id, id, channelId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const raw = await request.json();
  const parsed = validateBody(channelUpdateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { config, isActive, isPrimary } = parsed.data;
  const data: Record<string, unknown> = {};

  if (config !== undefined) data.config = config;
  if (isActive !== undefined) data.isActive = isActive;

  if (isPrimary === true) {
    // Unset other primaries first
    await prisma.providerChannel.updateMany({
      where: { providerId: id, isPrimary: true },
      data: { isPrimary: false },
    });
    data.isPrimary = true;
  } else if (isPrimary === false) {
    data.isPrimary = false;
  }

  const updated = await prisma.providerChannel.update({
    where: { id: channelId },
    data,
  });

  return NextResponse.json({ channel: updated });
}

/** DELETE /api/providers/[id]/channels/[channelId] — remove a channel */
export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id, channelId } = await params;
  const channel = await getOwnedChannel(user.id, id, channelId);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  await prisma.providerChannel.delete({ where: { id: channelId } });

  // If deleted channel was primary, promote the next one
  if (channel.isPrimary) {
    const next = await prisma.providerChannel.findFirst({
      where: { providerId: id },
      orderBy: { createdAt: "asc" },
    });
    if (next) {
      await prisma.providerChannel.update({
        where: { id: next.id },
        data: { isPrimary: true },
      });
    }
  }

  return NextResponse.json({ success: true });
}
