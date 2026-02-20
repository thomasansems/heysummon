import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function generateProviderKey(): string {
  const chars = "0123456789abcdef";
  let key = "htl_prov_";
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const providers = await prisma.provider.findMany({
    where: { userId: user.id },
    include: { _count: { select: { apiKeys: true } } },
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

  const provider = await prisma.provider.create({
    data: {
      name: name.trim(),
      key: generateProviderKey(),
      userId: user.id,
    },
  });

  return NextResponse.json({ provider });
}
