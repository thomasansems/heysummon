import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { channelCreateSchema, validateBody } from "@/lib/validations";

/** GET /api/providers/[id]/channels — list channels for a provider */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const provider = await prisma.userProfile.findUnique({ where: { id } });
  if (!provider || provider.userId !== user.id) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const channels = await prisma.channelProvider.findMany({
    where: { profileId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ channels });
}

/** POST /api/providers/[id]/channels — add a channel to a provider */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  const provider = await prisma.userProfile.findUnique({ where: { id } });
  if (!provider || provider.userId !== user.id) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const raw = await request.json();
  const parsed = validateBody(channelCreateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { type, config, name } = parsed.data;

  // Check for duplicate channel type
  const existing = await prisma.channelProvider.findFirst({
    where: { profileId: id, type },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Channel type "${type}" already exists for this provider` },
      { status: 409 }
    );
  }

  const channel = await prisma.channelProvider.create({
    data: {
      profileId: id,
      type,
      name: name || type,
      config: config ? JSON.stringify(config) : "{}",
    },
  });

  return NextResponse.json({ channel }, { status: 201 });
}
