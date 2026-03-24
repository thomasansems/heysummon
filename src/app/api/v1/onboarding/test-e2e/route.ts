import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * POST — Create a test HelpRequest for end-to-end verification
 * GET  — Poll the test request status
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKeyId } = await request.json();
  if (!apiKeyId) {
    return NextResponse.json({ error: "apiKeyId is required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, userId: user.id },
    include: { provider: true },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  if (!apiKey.provider) {
    return NextResponse.json(
      { error: "API key has no provider linked" },
      { status: 400 }
    );
  }

  // Generate ref code
  const refCode = `HS-TEST-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  // Create a test HelpRequest with a 5-minute TTL
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  const helpRequest = await prisma.helpRequest.create({
    data: {
      refCode,
      apiKeyId: apiKey.id,
      expertId: user.id,
      expiresAt,
      question: "This is a test question from the HeySummon onboarding wizard. Please respond to confirm your setup works.",
      messages: JSON.stringify([]),
    },
  });

  // Notify the provider through their channel
  const provider = await prisma.userProfile.findUnique({
    where: { id: apiKey.providerId! },
    include: { channelProviders: true },
  });

  if (provider) {
    const telegramCh = provider.channelProviders.find((c) => c.type === "telegram");
    if (telegramCh) {
      try {
        const config = JSON.parse(telegramCh.config || "{}");
        if (config.botToken && config.providerChatId) {
          const { sendMessage } = await import("@/lib/adapters/telegram");
          await sendMessage(
            config.botToken,
            config.providerChatId,
            `*Onboarding E2E Test*\n\nRef: \`${refCode}\`\n\nA test question was sent from your client. Reply with:\n\`/reply ${refCode} Test successful!\`\n\nto complete the end-to-end test.`
          );
        }
      } catch {
        // Non-fatal — the request is created regardless
      }
    }
  }

  return NextResponse.json({
    requestId: helpRequest.id,
    refCode,
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const requestId = searchParams.get("requestId");

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const helpRequest = await prisma.helpRequest.findFirst({
    where: { id: requestId, expertId: user.id },
    select: {
      status: true,
      respondedAt: true,
      response: true,
      createdAt: true,
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: helpRequest.status,
    responded: !!helpRequest.respondedAt,
    respondedAt: helpRequest.respondedAt,
    responsePreview: helpRequest.response
      ? helpRequest.response.slice(0, 100)
      : null,
  });
}
