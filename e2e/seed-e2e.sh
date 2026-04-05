#!/bin/bash
# Seed E2E test data -- creates experts, users, API keys
# Outputs JSON with all keys needed for the extended test suite
set -euo pipefail

BASE_URL="${E2E_BASE_URL:-http://localhost:3456}"

echo "Seeding E2E test data..." >&2

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLATFORM_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PLATFORM_DIR"

# Run seed script that outputs JSON with all keys
node -e "
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function seed() {
  // -- Expert A (primary test expert) --
  const userA = await prisma.user.upsert({
    where: { email: 'e2e-expert@test.local' },
    update: {},
    create: {
      email: 'e2e-expert@test.local',
      name: 'E2E Expert A',
      role: 'expert',
      onboardingComplete: true,
    },
  });

  const expertKeyA = 'hs_exp_' + crypto.randomBytes(24).toString('hex');
  let expertA = await prisma.userProfile.findFirst({ where: { userId: userA.id } });
  if (!expertA) {
    expertA = await prisma.userProfile.create({
      data: {
        name: 'E2E Test Expert A',
        key: expertKeyA,
        userId: userA.id,
        isActive: true,
      },
    });
  }

  // ExpertChannel for expert A (required -- help API rejects requests with no channel)
  await prisma.expertChannel.create({
    data: {
      profileId: expertA.id,
      type: 'openclaw',
      name: 'E2E OpenClaw Channel',
      isActive: true,
      status: 'connected',
      config: JSON.stringify({ openclaw: { notifyTarget: 'e2e-test' } }),
    },
  });

  // Client key for expert A
  const clientKeyA = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: clientKeyA,
      name: 'e2e-client-a',
      userId: userA.id,
      expertId: expertA.id,
      isActive: true,
    },
  });

  // -- Expert B (for wrong-expert tests) --
  const userB = await prisma.user.upsert({
    where: { email: 'e2e-expert-b@test.local' },
    update: {},
    create: {
      email: 'e2e-expert-b@test.local',
      name: 'E2E Expert B',
      role: 'expert',
      onboardingComplete: true,
    },
  });

  const expertKeyB = 'hs_exp_' + crypto.randomBytes(24).toString('hex');
  let expertB = await prisma.userProfile.findFirst({ where: { userId: userB.id } });
  if (!expertB) {
    expertB = await prisma.userProfile.create({
      data: {
        name: 'E2E Test Expert B',
        key: expertKeyB,
        userId: userB.id,
        isActive: true,
      },
    });
  }

  // ExpertChannel for expert B
  await prisma.expertChannel.create({
    data: {
      profileId: expertB.id,
      type: 'openclaw',
      name: 'E2E OpenClaw Channel B',
      isActive: true,
      status: 'connected',
      config: JSON.stringify({ openclaw: { notifyTarget: 'e2e-test-b' } }),
    },
  });

  // Client key for expert B
  const clientKeyB = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: clientKeyB,
      name: 'e2e-client-b',
      userId: userB.id,
      expertId: expertB.id,
      isActive: true,
    },
  });

  // -- Deactivated key (for isActive=false test) --
  const inactiveKey = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.create({
    data: {
      key: inactiveKey,
      name: 'e2e-inactive',
      userId: userA.id,
      expertId: expertA.id,
      isActive: false,
    },
  });

  // -- Key with device secret (for device token binding test) --
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
      expertId: expertA.id,
      isActive: true,
      deviceSecret: deviceSecret,
    },
  });

  console.log(JSON.stringify({
    expertId: expertA.id,
    expertKey: expertA.key,
    clientKey: clientKeyA,
    userId: userA.id,
    expert2Id: expertB.id,
    expert2Key: expertB.key,
    expert2ClientKey: clientKeyB,
    user2Id: userB.id,
    inactiveKey: inactiveKey,
    deviceKey: deviceKey,
    deviceToken: deviceToken,
  }));

  await prisma.\$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
" 2>/dev/null
