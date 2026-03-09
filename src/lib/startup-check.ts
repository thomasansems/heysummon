/**
 * Startup health check — logs database record counts to confirm data persistence.
 * Call once at server startup to verify the database is accessible and populated.
 */
import { prisma } from "./prisma";

export async function runStartupCheck(): Promise<void> {
  try {
    const [users, channelProviders, requests, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.channelProvider.count(),
      prisma.helpRequest.count(),
      prisma.auditLog.count(),
    ]);

    console.log(`✅ Database OK — users: ${users}, channels: ${channelProviders}, requests: ${requests}, audit logs: ${auditLogs}`);

    if (users === 0) {
      console.warn("⚠️  No users found in database. Run `npm run db:seed` to create demo data.");
    }
  } catch (err) {
    console.error("❌ Database startup check failed:", err);
    console.error("   Verify DATABASE_URL is set and the database file/connection is accessible.");
  }
}
