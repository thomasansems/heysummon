import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/keys/[id]/unlink
 * Removes the expertId link from an ApiKey (client key).
 * The key remains active but is no longer linked to an expert.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the key belongs to the user
  const key = await prisma.apiKey.findFirst({
    where: { id, userId: user.id },
  });

  if (!key) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  await prisma.apiKey.update({
    where: { id },
    data: { expertId: null },
  });

  return NextResponse.json({ success: true });
}
