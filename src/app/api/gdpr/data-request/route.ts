import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGdprSettings, deleteUserData } from "@/lib/gdpr";

/**
 * GET /api/gdpr/data-request — list own data requests
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const requests = await prisma.dataRequest.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ requests });
}

/**
 * POST /api/gdpr/data-request — request account deletion (self-service)
 * Body: { type: "deletion", confirm: true }
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();

  if (body.type !== "deletion") {
    return NextResponse.json({ error: "Only deletion requests are supported via this endpoint" }, { status: 400 });
  }

  if (!body.confirm) {
    return NextResponse.json({ error: "Must confirm with confirm: true" }, { status: 400 });
  }

  const settings = await getGdprSettings();
  if (settings.enabled && !settings.allowDataDeletion) {
    return NextResponse.json({ error: "Data deletion is currently disabled" }, { status: 403 });
  }

  const result = await deleteUserData(user.id);
  if (!result) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
