export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, messages, question, publicKey } = body;

    if (!apiKey || !messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "apiKey and messages array are required" },
        { status: 400 }
      );
    }

    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { user: true },
    });

    if (!key || !key.isActive) {
      return NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      );
    }

    const trimmedMessages = messages.slice(-10);
    const refCode = await generateUniqueRefCode();

    // If consumer provided a public key, generate a server key pair for this request
    let serverPubKey: string | undefined;
    let serverPrivKey: string | undefined;
    let storedMessages: string;
    const isEncrypted = !!publicKey;

    if (publicKey) {
      const serverKeyPair = generateKeyPair();
      serverPubKey = serverKeyPair.publicKey;
      serverPrivKey = serverKeyPair.privateKey;

      // Encrypt messages with server's public key for at-rest encryption
      storedMessages = encryptMessage(JSON.stringify(trimmedMessages), serverPubKey);
    } else {
      storedMessages = JSON.stringify(trimmedMessages);
    }

    const helpRequest = await prisma.helpRequest.create({
      data: {
        refCode,
        apiKeyId: key.id,
        expertId: key.userId,
        messages: storedMessages,
        question: question || null,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        encrypted: isEncrypted,
        consumerPublicKey: publicKey || null,
        serverPublicKey: serverPubKey || null,
        serverPrivateKey: serverPrivKey || null,
      },
    });

    const response: Record<string, unknown> = {
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      pollUrl: `/api/v1/help/${helpRequest.id}`,
    };

    if (serverPubKey) {
      response.serverPublicKey = serverPubKey;
    }

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
