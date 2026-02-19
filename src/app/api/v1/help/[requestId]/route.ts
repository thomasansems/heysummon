export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptMessage } from "@/lib/crypto";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
  });

  if (!helpRequest) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 }
    );
  }

  // Check if expired
  if (helpRequest.status === "pending" && new Date() > helpRequest.expiresAt) {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { status: "expired" },
    });

    return NextResponse.json({
      requestId: helpRequest.id,
      status: "expired",
    });
  }

  const response: Record<string, unknown> = {
    requestId: helpRequest.id,
    status: helpRequest.status,
  };

  if (helpRequest.status === "responded" && helpRequest.response) {
    // If the request was encrypted and consumer provided a public key,
    // encrypt the response with the consumer's public key
    if (helpRequest.encrypted && helpRequest.consumerPublicKey) {
      response.response = encryptMessage(helpRequest.response, helpRequest.consumerPublicKey);
      response.encrypted = true;
    } else {
      response.response = helpRequest.response;
    }
  }

  return NextResponse.json(response);
}
