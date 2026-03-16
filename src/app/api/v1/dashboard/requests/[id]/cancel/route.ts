import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/dashboard/requests/:id/cancel
 *
 * Cancels a pending or active request.
 * Auth: session cookie (dashboard user must own the request).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const helpRequest = await prisma.helpRequest.findFirst({
    where: { id, expertId: user.id },
    select: { id: true, status: true },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!["pending", "active"].includes(helpRequest.status)) {
    return NextResponse.json(
      { error: `Cannot cancel request with status '${helpRequest.status}'` },
      { status: 400 }
    );
  }

  const updated = await prisma.helpRequest.update({
    where: { id },
    data: {
      status: "cancelled",
      closedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    id: updated.id,
    status: updated.status,
  });
}
