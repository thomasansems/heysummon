import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ count: 0 });
  }

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (apiKeys.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const count = await prisma.ipEvent.count({
    where: {
      apiKeyId: { in: apiKeys.map((k) => k.id) },
      status: "pending",
    },
  });

  return NextResponse.json({ count });
}
