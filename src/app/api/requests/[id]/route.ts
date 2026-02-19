import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id },
    include: { apiKey: { select: { name: true } } },
  });

  if (!helpRequest || helpRequest.expertId !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Auto-mark as reviewing when expert opens it
  if (helpRequest.status === "pending") {
    await prisma.helpRequest.update({
      where: { id },
      data: { status: "reviewing" },
    });
    helpRequest.status = "reviewing";
  }

  return NextResponse.json({
    request: {
      ...helpRequest,
      messages: JSON.parse(helpRequest.messages as string),
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const helpRequest = await prisma.helpRequest.findUnique({ where: { id } });
  if (!helpRequest || helpRequest.expertId !== user.id) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (helpRequest.status === "expired") {
    return NextResponse.json({ error: "Request has expired" }, { status: 400 });
  }

  if (helpRequest.status === "responded") {
    return NextResponse.json({ error: "Already responded" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.status) {
    updateData.status = body.status;
  }

  if (body.response) {
    updateData.response = body.response;
    updateData.status = "responded";
    updateData.respondedAt = new Date();
  }

  const updated = await prisma.helpRequest.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ request: updated });
}
