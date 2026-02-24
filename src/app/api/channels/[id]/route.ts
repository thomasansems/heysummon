import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelUpdateSchema, validateBody } from "@/lib/validations";
import { openClawAdapter } from "@/lib/adapters/openclaw";
import { telegramAdapter } from "@/lib/adapters/telegram";
import type { ChannelAdapter, ChannelConfig } from "@/lib/adapters/types";

const adapters: Record<string, ChannelAdapter> = {
  openclaw: openClawAdapter,
  telegram: telegramAdapter,
};

async function getOwnedChannel(userId: string, channelId: string) {
  const channel = await prisma.channelProvider.findUnique({
    where: { id: channelId },
    include: { profile: { select: { userId: true } } },
  });
  if (!channel || channel.profile.userId !== userId) return null;
  return channel;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const channel = await getOwnedChannel(user.id, id);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const { profile: _p, ...rest } = channel;
  return NextResponse.json({ channel: rest });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const channel = await getOwnedChannel(user.id, id);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const raw = await request.json();
  const parsed = validateBody(channelUpdateSchema, raw);
  if (!parsed.success) return parsed.response;

  const body = parsed.data;
  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  if (body.config !== undefined) {
    const adapter = adapters[channel.type];
    if (adapter) {
      const currentConfig = JSON.parse(channel.config) as Record<string, unknown>;
      const mergedConfig = { ...currentConfig, ...body.config };
      const validation = adapter.validateConfig(mergedConfig);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      data.config = JSON.stringify(validation.config);
    }
  }

  const updated = await prisma.channelProvider.update({
    where: { id },
    data,
  });

  return NextResponse.json({ channel: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const channel = await getOwnedChannel(user.id, id);
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Run adapter deactivation hook
  const adapter = adapters[channel.type];
  if (adapter?.onDeactivate) {
    try {
      const config = JSON.parse(channel.config) as ChannelConfig;
      await adapter.onDeactivate(channel.id, config);
    } catch {
      // Non-fatal: still delete the channel
    }
  }

  await prisma.channelProvider.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
