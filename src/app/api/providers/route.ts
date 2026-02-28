import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const providers = await prisma.userProfile.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { apiKeys: true } },
      ipEvents: { orderBy: { lastSeen: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ providers });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name } = await request.json().catch(() => ({ name: null }));
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const provider = await prisma.userProfile.create({
    data: {
      name: name.trim(),
      key: generateApiKey("hs_prov_"),
      userId: user.id,
    },
  });

  return NextResponse.json({ provider });
}
