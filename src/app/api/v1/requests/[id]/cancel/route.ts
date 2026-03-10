import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/requests/:id/cancel — Cancel pending/retrying delivery.
 *
 * Stops further retry attempts for a request that is pending or retrying.
 * Auth: session cookie (dashboard user must own the request).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const helpRequest = await prisma.helpRequest.findFirst({
    where: { id, expertId: user.id },
    select: { id: true, deliveryStatus: true },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!["pending", "retrying"].includes(helpRequest.deliveryStatus)) {
    return NextResponse.json(
      { error: `Cannot cancel delivery with status '${helpRequest.deliveryStatus}'` },
      { status: 400 }
    );
  }

  await prisma.helpRequest.update({
    where: { id },
    data: {
      deliveryStatus: "cancelled",
      deliveryNextRetryAt: null,
    },
  });

  return NextResponse.json({ ok: true, message: "Delivery cancelled" });
}
