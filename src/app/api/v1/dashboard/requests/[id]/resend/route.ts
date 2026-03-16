import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";

const REQUEST_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * POST /api/v1/dashboard/requests/:id/resend
 *
 * Creates a new request duplicated from an existing responded/failed/expired one.
 * Auth: session cookie (dashboard user must own the original request).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const original = await prisma.helpRequest.findFirst({
    where: { id, expertId: user.id },
    select: {
      id: true,
      status: true,
      apiKeyId: true,
      expertId: true,
      question: true,
      messages: true,
      consumerPublicKey: true,
      consumerSignPubKey: true,
      consumerEncryptPubKey: true,
      channelProviderId: true,
      consumerChatId: true,
      consumerName: true,
    },
  });

  if (!original) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (!["responded", "failed", "expired"].includes(original.status)) {
    return NextResponse.json(
      { error: `Cannot resend request with status '${original.status}'` },
      { status: 400 }
    );
  }

  const refCode = await generateUniqueRefCode();
  const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

  const newRequest = await prisma.helpRequest.create({
    data: {
      refCode,
      apiKeyId: original.apiKeyId,
      expertId: original.expertId,
      status: "pending",
      expiresAt,
      question: original.question,
      messages: original.messages,
      consumerPublicKey: original.consumerPublicKey,
      consumerSignPubKey: original.consumerSignPubKey,
      consumerEncryptPubKey: original.consumerEncryptPubKey,
      channelProviderId: original.channelProviderId,
      consumerChatId: original.consumerChatId,
      consumerName: original.consumerName,
    },
  });

  return NextResponse.json({
    ok: true,
    id: newRequest.id,
    refCode: newRequest.refCode,
  });
}
