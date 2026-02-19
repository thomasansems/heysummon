import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    include: { _count: { select: { requests: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name } = await request.json().catch(() => ({ name: null }));

  const key = await prisma.apiKey.create({
    data: {
      key: generateApiKey(),
      name: name || null,
      userId: user.id,
    },
  });

  return NextResponse.json({ key });
}
