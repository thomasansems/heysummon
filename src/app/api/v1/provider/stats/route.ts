import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";

/**
 * GET /api/v1/provider/stats — pending count, open requests, total messages
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  const providerId = auth.apiKey.providerId!;

  // Get provider's user ID
  const provider = await prisma.userProfile.findUnique({
    where: { id: providerId },
    select: { userId: true },
  });

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  // Count requests by status
  const [pending, open, responded, total] = await Promise.all([
    prisma.helpRequest.count({
      where: { expertId: provider.userId, status: "pending" },
    }),
    prisma.helpRequest.count({
      where: { expertId: provider.userId, status: "open" },
    }),
    prisma.helpRequest.count({
      where: { expertId: provider.userId, status: "responded" },
    }),
    prisma.helpRequest.count({
      where: { expertId: provider.userId },
    }),
  ]);

  // Total messages sent by this provider
  const messageCount = await prisma.message.count({
    where: { from: "provider" },
  });

  return NextResponse.json({
    stats: {
      pending,
      open,
      responded,
      total,
      messagesSent: messageCount,
    },
  });
}
