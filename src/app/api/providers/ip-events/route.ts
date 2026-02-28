import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/providers/ip-events — List IP events for all provider profiles of the current user
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const profiles = await prisma.userProfile.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      key: true,
      ipEvents: {
        orderBy: { lastSeen: "desc" },
      },
    },
  });

  return NextResponse.json({ profiles });
}
