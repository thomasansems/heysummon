export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptMessage } from "@/lib/crypto";

/**
 * POST /api/relay/send
 * Forward an encrypted message to a provider.
 * Body: { requestId, message, senderPublicKey }
 */
export async function POST(request: Request) {
  try {
    const { requestId, message, senderPublicKey } = await request.json();

    if (!requestId || !message) {
      return NextResponse.json(
        { error: "requestId and message are required" },
        { status: 400 }
      );
    }

    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
    });

    if (!helpRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // If encrypted and we have a server key pair, re-encrypt for storage
    let storedMessage = message;
    if (helpRequest.serverPublicKey) {
      storedMessage = encryptMessage(message, helpRequest.serverPublicKey);
    }

    // Update the request's messages with the relayed content
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        messages: storedMessage,
        ...(senderPublicKey ? { consumerPublicKey: senderPublicKey } : {}),
      },
    });

    return NextResponse.json({ success: true, requestId });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
