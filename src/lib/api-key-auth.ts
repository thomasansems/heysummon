import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * Hash a device token using SHA-256.
 */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generate a random device secret with prefix.
 */
export function generateDeviceSecret(): string {
  return "hs_dev_" + crypto.randomBytes(16).toString("hex");
}

/**
 * Validate x-api-key and X-Device-Token headers.
 * Returns the ApiKey record on success, or a NextResponse error.
 */
export async function validateApiKeyRequest(
  request: Request,
  options?: { include?: Record<string, any> }
): Promise<
  | { ok: true; apiKey: any }
  | { ok: false; response: NextResponse }
> {
  const apiKeyHeader = request.headers.get("x-api-key");

  if (!apiKeyHeader) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "x-api-key header required" },
        { status: 401 }
      ),
    };
  }

  const keyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKeyHeader },
    ...(options?.include ? { include: options.include } : {}),
  });

  if (!keyRecord || !keyRecord.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      ),
    };
  }

  // Device token validation (backward compatible)
  if (keyRecord.deviceSecret) {
    const deviceToken = request.headers.get("x-device-token");
    if (!deviceToken || hashDeviceToken(deviceToken) !== keyRecord.deviceSecret) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Invalid or missing device token" },
          { status: 403 }
        ),
      };
    }
  }

  // Machine fingerprint validation (backward compatible)
  const machineId = request.headers.get("x-machine-id");

  if (keyRecord.machineId) {
    // Key is already bound to a machine
    if (!machineId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Machine fingerprint mismatch. This key is bound to another device." },
          { status: 403 }
        ),
      };
    }
    if (machineId !== keyRecord.machineId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Machine fingerprint mismatch. This key is bound to another device." },
          { status: 403 }
        ),
      };
    }
  } else if (machineId) {
    // First request with machine ID — bind it
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { machineId },
    });
    keyRecord.machineId = machineId;
  }

  return { ok: true, apiKey: keyRecord };
}
