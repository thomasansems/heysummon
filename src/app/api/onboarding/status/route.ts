import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [expertCount, clientCount] = await Promise.all([
    prisma.userProfile.count({ where: { userId: user.id } }),
    prisma.apiKey.count({ where: { userId: user.id } }),
  ]);

  let tunnelActive = false;
  try {
    const publicUrl = process.env.HEYSUMMON_PUBLIC_URL ?? null;
    tunnelActive =
      !!publicUrl &&
      !publicUrl.includes("localhost") &&
      !publicUrl.includes("127.0.0.1");
  } catch {
    // ignore
  }

  return NextResponse.json({
    onboardingComplete: user.onboardingComplete,
    hasExpert: expertCount > 0,
    hasClient: clientCount > 0,
    tunnelActive,
    expertCount,
    clientCount,
  });
}
