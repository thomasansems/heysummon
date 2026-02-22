import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { keyCreateSchema, validateBody } from "@/lib/validations";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { requests: true } },
      provider: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = validateBody(keyCreateSchema, raw);
  if (!parsed.success) return parsed.response;

  const { name, providerId } = parsed.data;

  const data: any = {
    key: generateApiKey(),
    name: name || null,
    userId: user.id,
  };

  if (providerId) {
    // Verify provider belongs to user
    const provider = await prisma.provider.findFirst({
      where: { id: providerId, userId: user.id },
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 400 });
    }
    data.providerId = providerId;
  }

  const key = await prisma.apiKey.create({ data });

  return NextResponse.json({ key });
}
