import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import crypto from "crypto";

const AUTO_BLACKLIST_THRESHOLD = 20;

/**
 * Hash a device token using SHA-256.
 */
export function hashDeviceToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Extract client IP from request headers.
 */
function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Validate a provider key (hs_prov_...) with IP binding and device secret.
 *
 * Flow:
 *   1. Lookup provider by key
 *   2. IP auto-bind (first request binds IP, new IPs go to "pending")
 *   3. Device secret validation (if set)
 *   4. Machine ID binding (if provided)
 *
 * Error messages include instructions to manage IPs/devices in the dashboard.
 */
export async function validateProviderKey(
  request: Request
): Promise<
  | { ok: true; provider: { id: string; userId: string; name: string } }
  | { ok: false; response: NextResponse }
> {
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "x-api-key header required" },
        { status: 401 }
      ),
    };
  }

  const provider = await prisma.userProfile.findFirst({
    where: { key: apiKey, isActive: true },
    select: {
      id: true,
      userId: true,
      name: true,
      deviceSecret: true,
      machineId: true,
    },
  });

  if (!provider) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or inactive provider key" },
        { status: 401 }
      ),
    };
  }

  // ── IP auto-bind ──
  const clientIp = getClientIp(request);
  const existingEvents = await prisma.ipEvent.findMany({
    where: { profileId: provider.id },
  });

  if (existingEvents.length === 0) {
    // First ever request — bind this IP as allowed
    await prisma.ipEvent.create({
      data: { profileId: provider.id, ip: clientIp, status: "allowed" },
    });
  } else {
    const matchingEvent = existingEvents.find((e) => e.ip === clientIp);

    if (matchingEvent) {
      if (matchingEvent.status === "blacklisted") {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: "IP address is blacklisted for this provider key",
              hint: "To unblock this IP, go to your HeySummon dashboard → Settings → IP Security and remove or allow this IP address.",
            },
            { status: 403 }
          ),
        };
      }
      if (matchingEvent.status === "pending") {
        const newAttempts = matchingEvent.attempts + 1;
        await prisma.ipEvent.update({
          where: { id: matchingEvent.id },
          data: {
            attempts: newAttempts,
            lastSeen: new Date(),
            ...(newAttempts >= AUTO_BLACKLIST_THRESHOLD
              ? { status: "blacklisted" }
              : {}),
          },
        });
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: "IP address not authorized for this provider key",
              hint: `This IP (${clientIp}) is pending approval. Go to your HeySummon dashboard → Settings → IP Security to allow it.`,
              ip: clientIp,
            },
            { status: 403 }
          ),
        };
      }
      // status === "allowed" → pass through
    } else {
      // New unknown IP → create as pending
      await prisma.ipEvent.upsert({
        where: {
          profileId_ip: { profileId: provider.id, ip: clientIp },
        },
        create: {
          profileId: provider.id,
          ip: clientIp,
          status: "pending",
        },
        update: {
          attempts: { increment: 1 },
          lastSeen: new Date(),
        },
      });
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "IP address not authorized for this provider key",
            hint: `New IP detected (${clientIp}). Go to your HeySummon dashboard → Settings → IP Security to allow it.`,
            ip: clientIp,
          },
          { status: 403 }
        ),
      };
    }
  }

  // ── Device secret validation ──
  if (provider.deviceSecret) {
    const deviceToken = request.headers.get("x-device-token");
    if (!deviceToken || hashDeviceToken(deviceToken) !== provider.deviceSecret) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "Invalid or missing device token",
            hint: "This provider key requires a device token. Include x-device-token header with the secret generated during setup.",
          },
          { status: 403 }
        ),
      };
    }
  }

  // ── Machine ID binding ──
  const machineId = request.headers.get("x-machine-id");

  if (provider.machineId) {
    if (!machineId || machineId !== provider.machineId) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "Machine fingerprint mismatch. This provider key is bound to another device.",
            hint: "To rebind to a new device, go to your HeySummon dashboard → Settings and reset the machine binding.",
          },
          { status: 403 }
        ),
      };
    }
  } else if (machineId) {
    await prisma.userProfile.update({
      where: { id: provider.id },
      data: { machineId },
    });
  }

  return {
    ok: true,
    provider: { id: provider.id, userId: provider.userId, name: provider.name },
  };
}
