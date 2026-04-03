import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";

/**
 * GET /api/v1/expert/stats — pending count, open requests, total messages
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  const expertId = auth.apiKey.expertId!;

  // Get expert's user ID
  const expert = await prisma.userProfile.findUnique({
    where: { id: expertId },
    select: { userId: true },
  });

  if (!expert) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  // Count requests by status
  const [pending, open, responded, total] = await Promise.all([
    prisma.helpRequest.count({
      where: { expertId: expert.userId, status: "pending" },
    }),
    prisma.helpRequest.count({
      where: { expertId: expert.userId, status: "open" },
    }),
    prisma.helpRequest.count({
      where: { expertId: expert.userId, status: "responded" },
    }),
    prisma.helpRequest.count({
      where: { expertId: expert.userId },
    }),
  ]);

  // Total messages sent by this expert
  const messageCount = await prisma.message.count({
    where: { from: "expert" },
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
