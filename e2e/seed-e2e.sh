#!/bin/bash
# Seed E2E test data — creates providers, users, API keys
# Outputs JSON with all keys needed for the extended test suite
set -euo pipefail

BASE_URL="${E2E_BASE_URL:-http://localhost:3456}"

echo "🌱 Seeding E2E test data..." >&2

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PLATFORM_DIR"

# Run seed script that outputs JSON with all keys
node -e "
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function seed() {
  // ── Provider A (primary test provider) ──
  const userA = await prisma.user.upsert({
    where: { email: 'e2e-provider@test.local' },
    update: {},
    create: {
      email: 'e2e-provider@test.local',
      name: 'E2E Provider A',
      role: 'expert',
      onboardingComplete: true,
    },
  });

  const providerKeyA = 'hs_prov_' + crypto.randomBytes(24).toString('hex');
  let providerA = await prisma.userProfile.findFirst({ where: { userId: userA.id } });
  if (!providerA) {
    providerA = await prisma.userProfile.create({
      data: {
        name: 'E2E Test Provider A',
        key: providerKeyA,
        userId: userA.id,
        isActive: true,
      },
    });
  }

  // ChannelProvider for provider A (required — help API rejects requests with no channel)
  await prisma.channelProvider.create({
    data: {
      profileId: providerA.id,
      type: 'openclaw',
      name: 'E2E OpenClaw Channel',
      isActive: true,
      status: 'connected',
      config: JSON.stringify({ openclaw: { notifyTarget: 'e2e-test' } }),
    },
  });

  // Client key for provider A
  const clientKeyA = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: clientKeyA,
      name: 'e2e-client-a',
      userId: userA.id,
      providerId: providerA.id,
      isActive: true,
    },
  });

  // ── Provider B (for wrong-provider tests) ──
  const userB = await prisma.user.upsert({
    where: { email: 'e2e-provider-b@test.local' },
    update: {},
    create: {
      email: 'e2e-provider-b@test.local',
      name: 'E2E Provider B',
      role: 'expert',
      onboardingComplete: true,
    },
  });

  const providerKeyB = 'hs_prov_' + crypto.randomBytes(24).toString('hex');
  let providerB = await prisma.userProfile.findFirst({ where: { userId: userB.id } });
  if (!providerB) {
    providerB = await prisma.userProfile.create({
      data: {
        name: 'E2E Test Provider B',
        key: providerKeyB,
        userId: userB.id,
        isActive: true,
      },
    });
  }

  // ChannelProvider for provider B
  await prisma.channelProvider.create({
    data: {
      profileId: providerB.id,
      type: 'openclaw',
      name: 'E2E OpenClaw Channel B',
      isActive: true,
      status: 'connected',
      config: JSON.stringify({ openclaw: { notifyTarget: 'e2e-test-b' } }),
    },
  });

  // Client key for provider B
  const clientKeyB = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: clientKeyB,
      name: 'e2e-client-b',
      userId: userB.id,
      providerId: providerB.id,
      isActive: true,
    },
  });

  // ── Deactivated key (for isActive=false test) ──
  const inactiveKey = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: inactiveKey,
      name: 'e2e-inactive',
      userId: userA.id,
      providerId: providerA.id,
      isActive: false,
    },
  });

  // ── Key with device secret (for device token binding test) ──
  const deviceToken = 'e2e-device-token-' + crypto.randomBytes(8).toString('hex');
  // HMAC-SHA256 matching hashDeviceToken() in api-key-auth.ts
  const hmacSecret = process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret';
  const deviceSecret = crypto.createHmac('sha256', hmacSecret).update(deviceToken).digest('hex');
  const deviceKey = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: deviceKey,
      name: 'e2e-device-bound',
      userId: userA.id,
      providerId: providerA.id,
      isActive: true,
      deviceSecret: deviceSecret,
    },
  });

  console.log(JSON.stringify({
    providerId: providerA.id,
    providerKey: providerA.key,
    clientKey: clientKeyA,
    userId: userA.id,
    provider2Id: providerB.id,
    provider2Key: providerB.key,
    provider2ClientKey: clientKeyB,
    user2Id: userB.id,
    inactiveKey: inactiveKey,
    deviceKey: deviceKey,
    deviceToken: deviceToken,
  }));

  await prisma.\$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
" 2>/dev/null
