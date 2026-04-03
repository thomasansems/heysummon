import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelUpdateSchema, validateBody } from "@/lib/validations";

type Params = { params: Promise<{ id: string; channelId: string }> };

/** Helper: verify ownership chain user → expert → channel */
async function getOwnedChannel(userId: string, expertId: string, channelId: string) {
  const expert = await prisma.userProfile.findUnique({ where: { id: expertId } });
  if (!expert || expert.userId !== userId) return null;

  const channel = await prisma.expertChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.profileId !== expertId) return null;

  return channel;
}

/** PATCH /api/experts/[id]/channels/[channelId] — update a channel */
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

  const { config, isActive } = parsed.data;
  const data: Record<string, unknown> = {};

  if (config !== undefined) data.config = config;
  if (isActive !== undefined) data.isActive = isActive;

  const updated = await prisma.expertChannel.update({
    where: { id: channelId },
    data,
  });

  return NextResponse.json({ channel: updated });
}

/** DELETE /api/experts/[id]/channels/[channelId] — remove a channel */
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

  await prisma.expertChannel.delete({ where: { id: channelId } });

  return NextResponse.json({ success: true });
}
