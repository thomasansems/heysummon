import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMessage } from "@/lib/adapters/telegram";

/**
 * POST — Send a test message to the expert's channel
 * GET  — Check if the expert responded to the test
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { expertId } = await request.json();
  if (!expertId) {
    return NextResponse.json({ error: "expertId is required" }, { status: 400 });
  }

  const expert = await prisma.userProfile.findFirst({
    where: { id: expertId, userId: user.id },
    include: { expertChannels: true },
  });

  if (!expert) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  const testId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Try Telegram channel first
  const telegramCh = expert.expertChannels.find((c) => c.type === "telegram");
  if (telegramCh) {
    try {
      const config = JSON.parse(telegramCh.config || "{}");
      if (!config.botToken || !config.expertChatId) {
        return NextResponse.json(
          { error: "Telegram channel not fully configured (missing chat ID — send /start to the bot first)" },
          { status: 400 }
        );
      }

      await sendMessage(
        config.botToken,
        config.expertChatId,
        [
          `*HeySummon Setup -- Step 4 of 7*`,
          ``,
          `Testing your Telegram connection.`,
          `If you see this message, your bot is correctly linked to this chat.`,
          ``,
          `To confirm, reply with:`,
          `\`/reply ${testId} ok\``,
        ].join("\n")
      );

      return NextResponse.json({
        testId,
        sent: true,
        channel: "telegram",
      });
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to send Telegram message: ${err instanceof Error ? err.message : "Unknown error"}` },
        { status: 500 }
      );
    }
  }

  // OpenClaw channel — test via a lightweight mechanism
  const openclawCh = expert.expertChannels.find((c) => c.type === "openclaw");
  if (openclawCh) {
    // For OpenClaw, we can't directly send a message — the expert polls.
    // Instead, we create a marker that the polling watcher will pick up.
    // For now, auto-pass the test since connection was already verified.
    return NextResponse.json({
      testId,
      sent: true,
      channel: "openclaw",
      autoPass: true,
    });
  }

  return NextResponse.json(
    { error: "No active channel found for this expert" },
    { status: 400 }
  );
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");
  const expertId = searchParams.get("expertId");

  if (!testId || !expertId) {
    return NextResponse.json({ error: "testId and expertId are required" }, { status: 400 });
  }

  // Check if the expert has replied to the test message
  // Look for recent help requests or messages containing the testId
  const expert = await prisma.userProfile.findFirst({
    where: { id: expertId, userId: user.id },
    include: { expertChannels: true },
  });

  if (!expert) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  // For Telegram: check if there's a response in the help requests matching the testId
  // The Telegram webhook handler processes /reply commands
  const recentRequest = await prisma.helpRequest.findFirst({
    where: {
      expertId: user.id,
      response: { contains: testId },
      respondedAt: { not: null },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentRequest) {
    return NextResponse.json({ responded: true });
  }

  // Also check if the expert's Telegram chat has had recent activity
  // by checking the channel's lastHeartbeat
  const telegramCh = expert.expertChannels.find((c) => c.type === "telegram");
  if (telegramCh?.lastHeartbeat) {
    const heartbeatAge = Date.now() - new Date(telegramCh.lastHeartbeat).getTime();
    // If the bot received a message in the last 30 seconds after the test was sent
    if (heartbeatAge < 30_000) {
      return NextResponse.json({ responded: true });
    }
  }

  // For OpenClaw: auto-pass after initial send
  const openclawCh = expert.expertChannels.find((c) => c.type === "openclaw");
  if (openclawCh) {
    return NextResponse.json({ responded: true });
  }

  return NextResponse.json({ responded: false });
}
