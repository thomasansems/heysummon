export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInstallCommand, PLATFORM_META, type ClientChannel } from "@/lib/setup-command";

/**
 * GET /api/v1/setup/[token]/command
 *
 * Returns the install command as JSON for programmatic consumption.
 * No session auth -- the opaque setup token is the authorization.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const record = await prisma.setupToken.findFirst({
    where: { token },
    include: {
      apiKey: { select: { id: true, key: true, name: true } },
    },
  });

  if (!record) {
    return NextResponse.json({ error: "Setup token not found" }, { status: 404 });
  }

  if (new Date() > record.expiresAt) {
    return NextResponse.json({ error: "Setup token has expired" }, { status: 410 });
  }

  const bound = await prisma.ipEvent.findFirst({
    where: { apiKeyId: record.apiKeyId, status: "allowed" },
    select: { id: true },
  });

  if (bound) {
    return NextResponse.json({ error: "A device is already bound to this key" }, { status: 409 });
  }

  const channel = record.channel as ClientChannel;
  const meta = PLATFORM_META[channel] ?? PLATFORM_META.claudecode;
  const expertName = record.expertName ?? "your expert";

  const installCommand = buildInstallCommand({
    channel,
    skillDir: meta.skillDir,
    baseUrl: record.baseUrl,
    apiKey: record.apiKey.key,
    timeout: record.timeout,
    pollInterval: record.pollInterval,
    timeoutFallback: record.timeoutFallback,
    globalInstall: record.globalInstall,
    expertName,
    summonContext: record.summonContext,
  });

  return NextResponse.json({
    channel,
    expertName,
    installCommand,
    summonContext: record.summonContext ?? null,
    verifyPrompt: `Hey summon ${expertName} to confirm this connection works`,
  });
}
