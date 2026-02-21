#!/bin/bash
# Seed E2E test data — creates provider, user, API keys
# Outputs key values for the test script
set -euo pipefail

BASE_URL="${E2E_BASE_URL:-http://localhost:3456}"
MERCURE_JWT_SECRET="${E2E_MERCURE_JWT_SECRET:-e2e-mercure-secret}"

echo "🌱 Seeding E2E test data..." >&2

# 1. Create provider user + provider via API (use internal seed endpoint)
# We'll use prisma directly via a small Node script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PLATFORM_DIR"

# Run seed script that outputs JSON with keys
node -e "
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function seed() {
  // Create user
  const user = await prisma.user.upsert({
    where: { email: 'e2e-provider@test.local' },
    update: {},
    create: {
      email: 'e2e-provider@test.local',
      name: 'E2E Provider',
      role: 'expert',
      onboardingComplete: true,
    },
  });

  // Create provider
  const providerKey = 'htl_prov_' + crypto.randomBytes(24).toString('hex');
  let provider = await prisma.provider.findFirst({ where: { userId: user.id } });
  if (!provider) {
    provider = await prisma.provider.create({
      data: {
        name: 'E2E Test Provider',
        key: providerKey,
        userId: user.id,
        isActive: true,
      },
    });
  }

  // Create client API key
  const clientKey = 'htl_cli_' + crypto.randomBytes(24).toString('hex');
  const apiKey = await prisma.apiKey.create({
    data: {
      key: clientKey,
      name: 'e2e-client',
      userId: user.id,
      providerId: provider.id,
      isActive: true,
    },
  });

  console.log(JSON.stringify({
    providerId: provider.id,
    providerKey: provider.key,
    clientKey: clientKey,
    userId: user.id,
  }));

  await prisma.\$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
" 2>/dev/null
