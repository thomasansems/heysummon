import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const AUTO_BLACKLIST_THRESHOLD = 20;

// ── Per-key rate limiting (in-memory sliding window) ──

const keyRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of keyRateLimitMap) {
    if (now > val.resetAt) keyRateLimitMap.delete(key);
  }
}, 300_000);

/**
 * Hash a device token using HMAC-SHA256 with the server secret.
 * Deterministic for DB lookup, but requires NEXTAUTH_SECRET to reproduce —
 * infeasible to reverse from DB alone.
 */
export function hashDeviceToken(token: string): string {
  const hmacSecret = process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret";
  return crypto.createHmac("sha256", hmacSecret).update(token).digest("hex");
}

/**
 * Generate a random device secret with prefix.
 */
export function generateDeviceSecret(): string {
  return "hs_dev_" + crypto.randomBytes(16).toString("hex");
}

/**
 * Redact an API key for safe display/logging.
 * "hs_cli_abcdef...1234" → "hs_cli_••••••••1234"
 */
export function redactKey(key: string): string {
  // Keep prefix (up to first _ after hs_) and last 4 chars
  const prefixMatch = key.match(/^(hs_\w+_)/);
  const prefix = prefixMatch ? prefixMatch[1] : key.slice(0, 7);
  const suffix = key.slice(-4);
  return `${prefix}${"•".repeat(8)}${suffix}`;
}

/**
 * Check if a scope allows the given HTTP method.
 *
 * Scope matrix:
 *   full  → all methods
 *   read  → GET only
 *   write → POST, PUT, PATCH, DELETE
 *   admin → all + key management endpoints
 */
export function isScopeAllowed(
  scope: string,
  method: string,
  isKeyManagement = false
): boolean {
  if (isKeyManagement) return scope === "admin";

  switch (scope) {
    case "full":
    case "admin":
      return true;
    case "read":
      return method === "GET";
    case "write":
      return ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    default:
      return false;
  }
}

/**
 * Check if a key has exceeded its per-minute rate limit.
 * Returns true if rate limited.
 */
export function isKeyRateLimited(keyId: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const entry = keyRateLimitMap.get(keyId);

  if (!entry || now > entry.resetAt) {
    keyRateLimitMap.set(keyId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > maxPerMinute;
}

/**
 * Strip API key values from error strings for safe logging.
 */
export function sanitizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Replace any hs_cli_... or hs_prov_... or hs_dev_... patterns
  return msg.replace(/hs_(cli|prov|dev)_[a-f0-9]+/gi, (match) => redactKey(match));
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
 * Validate x-api-key and X-Device-Token headers with enhanced security checks.
 *
 * Flow:
 *   1. Extract x-api-key header
 *   2. Lookup by plaintext key
 *   3. Rotation fallback: hash key → query previousKeyHash where grace period active
 *   4. Check isActive
 *   5. IP allowlist check
 *   6. Scope check (HTTP method vs key scope)
 *   7. Device token validation
 *   8. Machine fingerprint binding
 *   9. Per-key rate limit
 */
export async function validateApiKeyRequest(
  request: Request,
  options?: {
    include?: Record<string, unknown>;
    isKeyManagement?: boolean;
    apiKeyOverride?: string;
  }
): Promise<
  | { ok: true; apiKey: any; rotated?: boolean }
  | { ok: false; response: NextResponse }
> {
  const apiKeyValue = options?.apiKeyOverride || request.headers.get("x-api-key");

  if (!apiKeyValue) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "x-api-key header required" },
        { status: 401 }
      ),
    };
  }

  // 2. Lookup by plaintext key
  let keyRecord = await prisma.apiKey.findUnique({
    where: { key: apiKeyValue },
    ...(options?.include ? { include: options.include } : {}),
  });

  let rotated = false;

  // 3. Rotation fallback: HMAC-SHA256 lookup of rotated key within grace period.
  // HMAC with server secret (NEXTAUTH_SECRET) — deterministic for DB lookup but
  // infeasible to reverse without the server secret, even with DB access.
  if (!keyRecord) {
    const hmacSecret = process.env.NEXTAUTH_SECRET ?? "fallback-dev-secret";
    const hashedKey = crypto.createHmac("sha256", hmacSecret).update(apiKeyValue).digest("hex");
    keyRecord = await prisma.apiKey.findFirst({
      where: {
        previousKeyHash: hashedKey,
        previousKeyExpiresAt: { gt: new Date() },
      },
      ...(options?.include ? { include: options.include } : {}),
    });
    if (keyRecord) {
      rotated = true;
    }
  }

  // 4. Check exists and active
  if (!keyRecord || !keyRecord.isActive) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid or inactive API key" },
        { status: 401 }
      ),
    };
  }

  // 5. Auto IP-bind check
  {
    const clientIp = getClientIp(request);
    const existingEvents = await prisma.ipEvent.findMany({
      where: { apiKeyId: keyRecord.id },
    });

    if (existingEvents.length === 0) {
      // First ever request for this key — bind this IP as allowed
      await prisma.ipEvent.create({
        data: { apiKeyId: keyRecord.id, ip: clientIp, status: "allowed" },
      });
    } else {
      const matchingEvent = existingEvents.find((e) => e.ip === clientIp);

      if (matchingEvent) {
        if (matchingEvent.status === "blacklisted") {
          return {
            ok: false,
            response: NextResponse.json(
              {
                error: "IP address is blacklisted for this API key",
                hint: "To unblock this IP, go to your HeySummon dashboard → Clients → select the key → IP Security and remove or allow this IP address.",
              },
              { status: 403 }
            ),
          };
        }
        if (matchingEvent.status === "pending") {
          // Increment attempts, auto-blacklist at threshold
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
                error: "IP address not authorized for this API key",
                hint: `This IP (${clientIp}) is pending approval. Go to your HeySummon dashboard → Clients → select the key → IP Security to allow it.`,
                ip: clientIp,
              },
              { status: 403 }
            ),
          };
        }
        // status === "allowed" → pass through
      } else {
        // New unknown IP → upsert as pending
        await prisma.ipEvent.upsert({
          where: {
            apiKeyId_ip: { apiKeyId: keyRecord.id, ip: clientIp },
          },
          create: {
            apiKeyId: keyRecord.id,
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
              error: "IP address not authorized for this API key",
              hint: `New IP detected (${clientIp}). Go to your HeySummon dashboard → Clients → select the key → IP Security to allow it.`,
              ip: clientIp,
            },
            { status: 403 }
          ),
        };
      }
    }
  }

  // 6. Scope check
  const method = request.method;
  if (!isScopeAllowed(keyRecord.scope, method, options?.isKeyManagement)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Scope "${keyRecord.scope}" does not allow ${method} requests` },
        { status: 403 }
      ),
    };
  }

  // 7. Device token validation (backward compatible)
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

  // 8. Machine fingerprint validation (backward compatible)
  const machineId = request.headers.get("x-machine-id");

  if (keyRecord.machineId) {
    if (!machineId || machineId !== keyRecord.machineId) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Machine fingerprint mismatch. This key is bound to another device." },
          { status: 403 }
        ),
      };
    }
  } else if (machineId) {
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { machineId },
    });
    keyRecord.machineId = machineId;
  }

  // 9. Per-key rate limit
  if (isKeyRateLimited(keyRecord.id, keyRecord.rateLimitPerMinute)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Per-key rate limit exceeded" },
        { status: 429, headers: { "Retry-After": "60" } }
      ),
    };
  }

  return { ok: true, apiKey: keyRecord, rotated };
}
