export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth-config";
import { isCloud } from "@/lib/edition";
import { getOverview } from "@/lib/analytics.cloud";

const querySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

export async function GET(request: NextRequest) {
  if (!isCloud()) {
    return NextResponse.json({ error: "Cloud-only feature" }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const now = new Date();
  const from = parsed.data.from ? new Date(parsed.data.from) : new Date(now.getTime() - 30 * 86400000);
  const to = parsed.data.to ? new Date(parsed.data.to + "T23:59:59.999Z") : now;

  const overview = await getOverview(session.user.id, from, to);
  return NextResponse.json(overview);
}
