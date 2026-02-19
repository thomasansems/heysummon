import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      expertise: true,
      notificationPref: true,
      telegramChatId: true,
    },
  });

  return NextResponse.json(full || {});
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { expertise, notificationPref, telegramChatId } = await request.json();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      expertise: expertise || null,
      notificationPref: notificationPref || "email",
      telegramChatId: telegramChatId || null,
    },
  });

  return NextResponse.json({ ok: true });
}
