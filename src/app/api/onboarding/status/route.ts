import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [expertCount, clientCount] = await Promise.all([
    prisma.userProfile.count(),
    prisma.apiKey.count(),
  ]);

  const platformConfigured = expertCount > 0 && clientCount > 0;

  let onboardingComplete = user.onboardingComplete;
  if (!onboardingComplete && platformConfigured) {
    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingComplete: true },
    });
    onboardingComplete = true;
  }

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
    onboardingComplete,
    hasExpert: expertCount > 0,
    hasClient: clientCount > 0,
    tunnelActive,
    expertCount,
    clientCount,
  });
}
