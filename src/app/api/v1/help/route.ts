export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";
import { randomBytes, createHmac } from "node:crypto";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey, messages, question, publicKey, webhookUrl } = body;

    // Validate required fields
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

    if (!webhookUrl) {
      return NextResponse.json(
        { error: "webhookUrl is required — responses are delivered via webhook" },
        { status: 400 }
      );
    }

    // Validate webhook URL
    try {
      const url = new URL(webhookUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Invalid protocol");
      }
    } catch {
      return NextResponse.json(
        { error: "webhookUrl must be a valid HTTP(S) URL" },
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

    // Generate webhook secret for HMAC signature
    const webhookSecret = randomBytes(32).toString("hex");

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
        webhookUrl,
        webhookSecret,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min
      },
    });

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      webhookSecret, // Consumer stores this to verify webhook signatures
      serverPublicKey: serverKeyPair.publicKey,
    });
  } catch (err) {
    console.error("Help request error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
