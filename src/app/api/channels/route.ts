import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelCreateSchema, validateBody } from "@/lib/validations";
import { openClawAdapter } from "@/lib/adapters/openclaw";
import { telegramAdapter } from "@/lib/adapters/telegram";
import type { ChannelAdapter } from "@/lib/adapters/types";

const adapters: Record<string, ChannelAdapter> = {
  openclaw: openClawAdapter,
  telegram: telegramAdapter,
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const channels = await prisma.channelProvider.findMany({
    where: { profile: { userId: user.id } },
    include: { profile: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ channels });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = validateBody(channelCreateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { profileId, type, name, config } = parsed.data;

  // Verify profile belongs to user
  const profile = await prisma.userProfile.findFirst({
    where: { id: profileId, userId: user.id },
  });
  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 400 });
  }

  // Validate config with adapter
  const adapter = adapters[type];
  if (!adapter) {
    return NextResponse.json({ error: "Unsupported channel type" }, { status: 400 });
  }

  const validation = adapter.validateConfig(config);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const channel = await prisma.channelProvider.create({
    data: {
      profileId,
      type,
      name,
      config: JSON.stringify(validation.config),
      status: "connected",
    },
  });

  // Run adapter activation hook
  if (adapter.onActivate) {
    try {
      await adapter.onActivate(channel.id, validation.config);
    } catch (err) {
      // Update status to error but don't fail the create
      await prisma.channelProvider.update({
        where: { id: channel.id },
        data: {
          status: "error",
          errorMessage: err instanceof Error ? err.message : "Activation failed",
        },
      });
    }
  }

  // Reload to get latest status
  const updated = await prisma.channelProvider.findUnique({ where: { id: channel.id } });

  return NextResponse.json({ channel: updated });
}
