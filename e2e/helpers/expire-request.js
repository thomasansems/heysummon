#!/usr/bin/env node
/**
 * Force-expire a help request by setting expiresAt to the past.
 *
 * Usage: node expire-request.js <requestId>
 *
 * Env: DATABASE_URL
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const requestId = process.argv[2];
  if (!requestId) {
    console.error("Usage: node expire-request.js <requestId>");
    process.exit(1);
  }

  await prisma.helpRequest.update({
    where: { id: requestId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  console.log("OK");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
