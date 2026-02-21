import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refCode: string }> }
) {
  const { refCode } = await params;
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key" }, { status: 401 });
  }

  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      refCode,
      expert: {
        providers: {
          some: { key: apiKey },
        },
      },
    },
    select: {
      id: true,
      refCode: true,
      status: true,
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({ requestId: helpRequest.id, refCode: helpRequest.refCode, status: helpRequest.status });
}
