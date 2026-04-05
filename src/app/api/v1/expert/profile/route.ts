import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";

/**
 * GET /api/v1/expert/profile — get expert profile
 */
export async function GET(request: NextRequest) {
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  const expert = await prisma.userProfile.findUnique({
    where: { id: auth.apiKey.expertId! },
    select: {
      id: true,
      name: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      digestTime: true,
      user: { select: { name: true, email: true } },
      createdAt: true,
    },
  });

  if (!expert) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  return NextResponse.json({ expert });
}

/**
 * PATCH /api/v1/expert/profile — update expert settings
 */
export async function PATCH(request: NextRequest) {
  const auth = await validateApiKeyRequest(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const { name, timezone, quietHoursStart, quietHoursEnd, digestTime } = body;

  const expert = await prisma.userProfile.update({
    where: { id: auth.apiKey.expertId! },
    data: {
      ...(name && { name: name.trim() }),
      ...(timezone !== undefined && { timezone }),
      ...(quietHoursStart !== undefined && { quietHoursStart }),
      ...(quietHoursEnd !== undefined && { quietHoursEnd }),
      ...(digestTime !== undefined && { digestTime }),
    },
    select: {
      id: true,
      name: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      digestTime: true,
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json({ expert });
}
