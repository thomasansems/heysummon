import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelCreateSchema, validateBody } from "@/lib/validations";

/** GET /api/experts/[id]/channels — list channels for an expert */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const expert = await prisma.userProfile.findUnique({ where: { id } });
  if (!expert || expert.userId !== user.id) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  const channels = await prisma.expertChannel.findMany({
    where: { profileId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ channels });
}

/** POST /api/experts/[id]/channels — add a channel to an expert */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const expert = await prisma.userProfile.findUnique({ where: { id } });
  if (!expert || expert.userId !== user.id) {
    return NextResponse.json({ error: "Expert not found" }, { status: 404 });
  }

  const raw = await request.json();
  const parsed = validateBody(channelCreateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { type, config, name } = parsed.data;

  // Check for duplicate channel type
  const existing = await prisma.expertChannel.findFirst({
    where: { profileId: id, type },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Channel type "${type}" already exists for this expert` },
      { status: 409 }
    );
  }

  const channel = await prisma.expertChannel.create({
    data: {
      profileId: id,
      type,
      name: name || type,
      config: config ? JSON.stringify(config) : "{}",
    },
  });

  return NextResponse.json({ channel }, { status: 201 });
}
