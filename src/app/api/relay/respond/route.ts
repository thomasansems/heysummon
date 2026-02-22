export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { relayRespondSchema, validateBody } from "@/lib/validations";

/**
 * POST /api/relay/respond
 * Provider sends an encrypted response back.
 * Body: { requestId, response }
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = validateBody(relayRespondSchema, raw);
    if (!parsed.success) return parsed.response;

    const { requestId, response } = parsed.data;

    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
    });

    if (!helpRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (helpRequest.status === "expired") {
      return NextResponse.json({ error: "Request has expired" }, { status: 400 });
    }

    if (helpRequest.status === "responded") {
      return NextResponse.json({ error: "Already responded" }, { status: 400 });
    }

    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        response,
        status: "responded",
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, requestId });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
