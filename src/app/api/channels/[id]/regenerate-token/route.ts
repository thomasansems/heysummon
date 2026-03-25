import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TelegramConfig } from "@/lib/adapters/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const channel = await prisma.channelProvider.findUnique({
    where: { id },
    include: { profile: { select: { userId: true } } },
  });

  if (!channel || channel.profile.userId !== user.id) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (channel.type !== "telegram") {
    return NextResponse.json({ error: "Only Telegram channels support setup tokens" }, { status: 400 });
  }

  const config = JSON.parse(channel.config) as TelegramConfig;
  const setupToken = crypto.randomBytes(16).toString("hex");

  const newConfig: TelegramConfig = {
    ...config,
    setupToken,
    providerChatId: undefined, // Clear existing binding so re-pair is required
  };

  await prisma.channelProvider.update({
    where: { id },
    data: { config: JSON.stringify(newConfig) },
  });

  return NextResponse.json({ config: newConfig });
}
