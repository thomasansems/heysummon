export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";

/**
 * POST /api/v1/help — Submit a help request.
 *
 * Required: apiKey, messages[], publicKey
 * Optional: question
 *
 * Returns: requestId, refCode, status, serverPublicKey
 * Consumer then polls GET /api/v1/help/:requestId for the response.
 */
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

    if (!publicKey) {
      return NextResponse.json(
        { error: "publicKey is required — E2E encryption is mandatory" },
        { status: 400 }
      );
    }

    // Validate API key
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

    // Generate server key pair for at-rest encryption
    const serverKeyPair = generateKeyPair();

    // Encrypt messages and question at rest with server's public key
    const encryptedMessages = encryptMessage(
      JSON.stringify(trimmedMessages),
      serverKeyPair.publicKey
    );
    const encryptedQuestion = question
      ? encryptMessage(question, serverKeyPair.publicKey)
      : null;

    const helpRequest = await prisma.helpRequest.create({
      data: {
        refCode,
        apiKeyId: key.id,
        expertId: key.userId,
        messages: encryptedMessages,
        question: encryptedQuestion,
        consumerPublicKey: publicKey,
        serverPublicKey: serverKeyPair.publicKey,
        serverPrivateKey: serverKeyPair.privateKey,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      serverPublicKey: serverKeyPair.publicKey,
      expiresAt: helpRequest.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("Help request error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
