import { prisma } from "./prisma";

/**
 * GDPR utilities for HeySummon.
 *
 * IP anonymization strategy:
 * - IpEvent table keeps FULL IPs — needed for device binding (legitimate interest under GDPR Art. 6(1)(f))
 * - AuditLog IPs are anonymized when GDPR is enabled (last octet zeroed for IPv4, last 80 bits for IPv6)
 * - Data exports anonymize IPs by default
 */

let cachedSettings: { enabled: boolean; anonymizeIps: boolean; retentionDays: number; requireConsent: boolean; allowDataExport: boolean; allowDataDeletion: boolean; privacyPolicyUrl: string | null } | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Get GDPR settings (cached for 1 minute).
 */
export async function getGdprSettings() {
  if (cachedSettings && Date.now() < cacheExpiry) {
    return cachedSettings;
  }

  const settings = await prisma.gdprSettings.findUnique({
    where: { id: "singleton" },
  });

  cachedSettings = settings
    ? {
        enabled: settings.enabled,
        anonymizeIps: settings.anonymizeIps,
        retentionDays: settings.retentionDays,
        requireConsent: settings.requireConsent,
        allowDataExport: settings.allowDataExport,
        allowDataDeletion: settings.allowDataDeletion,
        privacyPolicyUrl: settings.privacyPolicyUrl,
      }
    : {
        enabled: false,
        anonymizeIps: true,
        retentionDays: 90,
        requireConsent: true,
        allowDataExport: true,
        allowDataDeletion: true,
        privacyPolicyUrl: null,
      };

  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedSettings;
}

/** Invalidate the GDPR settings cache (call after updates). */
export function invalidateGdprCache() {
  cachedSettings = null;
  cacheExpiry = 0;
}

/**
 * Anonymize an IPv4 address by zeroing the last octet.
 * For IPv6, zeros the last 80 bits (keeps /48 prefix).
 * Preserves subnet ranges so IP validation still works at the network level.
 *
 * Examples:
 *   "192.168.1.105" → "192.168.1.0"
 *   "2001:db8:85a3::8a2e:370:7334" → "2001:db8:85a3::"
 */
export function anonymizeIp(ip: string): string {
  if (!ip || ip === "unknown") return ip;

  // IPv4
  if (ip.includes(".") && !ip.includes(":")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      parts[3] = "0";
      return parts.join(".");
    }
    return ip;
  }

  // IPv6
  if (ip.includes(":")) {
    // Expand and zero the last 5 groups (80 bits) — keep /48
    const expanded = expandIPv6(ip);
    const groups = expanded.split(":");
    for (let i = 3; i < 8; i++) {
      groups[i] = "0000";
    }
    return compressIPv6(groups.join(":"));
  }

  return ip;
}

function expandIPv6(ip: string): string {
  // Handle IPv4-mapped IPv6
  if (ip.includes(".")) {
    return ip; // Leave as-is, anonymizeIp handles v4 part
  }

  let parts = ip.split("::");
  if (parts.length === 1) {
    // No :: found
    return ip;
  }

  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts[1] ? parts[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  const middle = Array(missing).fill("0000");

  return [...left, ...middle, ...right]
    .map((g) => g.padStart(4, "0"))
    .join(":");
}

function compressIPv6(expanded: string): string {
  const groups = expanded.split(":").map((g) => g.replace(/^0+/, "") || "0");
  // Find longest run of "0" groups
  let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
  for (let i = 0; i < groups.length; i++) {
    if (groups[i] === "0") {
      if (curStart === -1) curStart = i;
      curLen++;
      if (curLen > bestLen) { bestStart = curStart; bestLen = curLen; }
    } else {
      curStart = -1;
      curLen = 0;
    }
  }

  if (bestLen >= 2) {
    const before = groups.slice(0, bestStart);
    const after = groups.slice(bestStart + bestLen);
    return (before.length === 0 ? ":" : before.join(":")) + ":" + (after.length === 0 ? ":" : after.join(":"));
  }

  return groups.join(":");
}

/**
 * Conditionally anonymize an IP based on current GDPR settings.
 * Used in audit logging — returns full IP if GDPR is disabled.
 */
export async function maybeAnonymizeIp(ip: string | null): Promise<string | null> {
  if (!ip) return ip;

  const settings = await getGdprSettings();
  if (settings.enabled && settings.anonymizeIps) {
    return anonymizeIp(ip);
  }
  return ip;
}

/**
 * Export all data for a user (GDPR Art. 15 — Right of Access).
 * Returns a structured JSON object with all user-related data.
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      accounts: true,
      providers: {
        include: {
          channelProviders: true,
          ipEvents: true,
        },
      },
      sessions: true,
      certificates: true,
      consents: true,
      apiKeys: {
        include: {
          ipEvents: true,
        },
      },
    },
  });

  if (!user) return null;

  // Fetch requests where user is the expert
  const requests = await prisma.helpRequest.findMany({
    where: { expertId: userId },
    include: {
      messageHistory: true,
    },
  });

  // Fetch audit logs for this user
  const auditLogs = await prisma.auditLog.findMany({
    where: { userId },
  });

  const settings = await getGdprSettings();

  // Anonymize IPs in export if GDPR enabled
  const processIp = (ip: string | null) => {
    if (!ip) return ip;
    return settings.enabled && settings.anonymizeIps ? anonymizeIp(ip) : ip;
  };

  return {
    exportDate: new Date().toISOString(),
    gdprArticle: "Art. 15 GDPR — Right of Access",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      onboardingComplete: user.onboardingComplete,
      expertise: user.expertise,
      notificationPref: user.notificationPref,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    accounts: user.accounts.map(({ id, type, provider }) => ({ id, type, provider })),
    providers: user.providers.map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      isActive: p.isActive,
      timezone: p.timezone,
      createdAt: p.createdAt,
      channelProviders: p.channelProviders.map((cp) => ({
        id: cp.id,
        type: cp.type,
        name: cp.name,
        isActive: cp.isActive,
        paired: cp.paired,
        createdAt: cp.createdAt,
      })),
      ipEvents: p.ipEvents.map((e) => ({
        id: e.id,
        ip: processIp(e.ip),
        status: e.status,
        attempts: e.attempts,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
      })),
    })),
    apiKeys: user.apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      scope: k.scope,
      isActive: k.isActive,
      clientChannel: k.clientChannel,
      clientSubChannel: k.clientSubChannel,
      rateLimitPerMinute: k.rateLimitPerMinute,
      createdAt: k.createdAt,
      ipEvents: k.ipEvents.map((e) => ({
        id: e.id,
        ip: processIp(e.ip),
        status: e.status,
        attempts: e.attempts,
        firstSeen: e.firstSeen,
        lastSeen: e.lastSeen,
      })),
    })),
    sessions: user.sessions.map(({ id, expires }) => ({ id, expires })),
    certificates: user.certificates.map((c) => ({
      id: c.id,
      name: c.name,
      fingerprint: c.fingerprint,
      notBefore: c.notBefore,
      notAfter: c.notAfter,
      revoked: c.revoked,
      createdAt: c.createdAt,
    })),
    consents: user.consents,
    requests: requests.map((r) => ({
      id: r.id,
      refCode: r.refCode,
      status: r.status,
      questionPreview: r.questionPreview,
      requiresApproval: r.requiresApproval,
      approvalDecision: r.approvalDecision,
      rating: r.rating,
      ratingFeedback: r.ratingFeedback,
      consumerName: r.consumerName,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      closedAt: r.closedAt,
      messageHistory: r.messageHistory.map((m) => ({
        id: m.id,
        from: m.from,
        messageId: m.messageId,
        createdAt: m.createdAt,
        ciphertext: m.ciphertext,
        iv: m.iv,
        authTag: m.authTag,
      })),
    })),
    auditLogs: auditLogs.map((l) => ({
      id: l.id,
      eventType: l.eventType,
      ip: processIp(l.ip),
      userAgent: l.userAgent,
      success: l.success,
      createdAt: l.createdAt,
    })),
  };
}

/**
 * Delete all data for a user (GDPR Art. 17 — Right to Erasure).
 * Cascading deletes handle most related records.
 * Returns summary of what was deleted.
 */
export async function deleteUserData(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // Count records before deletion for the summary
  const [requestCount, auditCount, apiKeyCount, profileCount] = await Promise.all([
    prisma.helpRequest.count({ where: { expertId: userId } }),
    prisma.auditLog.count({ where: { userId } }),
    prisma.apiKey.count({ where: { userId } }),
    prisma.userProfile.count({ where: { userId } }),
  ]);

  // Delete in correct order to respect foreign keys
  // 1. Delete help requests (and cascading messages)
  await prisma.helpRequest.deleteMany({ where: { expertId: userId } });

  // 2. Delete audit logs
  await prisma.auditLog.deleteMany({ where: { userId } });

  // 3. Delete API keys (cascading ip events)
  await prisma.apiKey.deleteMany({ where: { userId } });

  // 4. Delete user profiles (cascading channel providers, ip events)
  await prisma.userProfile.deleteMany({ where: { userId } });

  // 5. Delete the user (cascading accounts, sessions, certificates, consents, data requests)
  await prisma.user.delete({ where: { id: userId } });

  return {
    deletedAt: new Date().toISOString(),
    gdprArticle: "Art. 17 GDPR — Right to Erasure",
    summary: {
      helpRequests: requestCount,
      auditLogs: auditCount,
      apiKeys: apiKeyCount,
      profiles: profileCount,
      user: 1,
    },
  };
}
