#!/bin/bash
# Seed MCP E2E test data — creates one provider + one client API key for MCP tests.
# Outputs JSON: { providerId, providerKey, clientKey }
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

node -e "
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function seed() {
  const user = await prisma.user.upsert({
    where: { email: 'mcp-e2e-provider@test.local' },
    update: {},
    create: {
      email: 'mcp-e2e-provider@test.local',
      name: 'MCP E2E Provider',
      role: 'expert',
      onboardingComplete: true,
    },
  });

  const providerKey = 'hs_prov_' + crypto.randomBytes(24).toString('hex');
  let profile = await prisma.userProfile.findFirst({ where: { userId: user.id } });
  if (!profile) {
    profile = await prisma.userProfile.create({
      data: {
        name: 'MCP E2E Provider',
        key: providerKey,
        userId: user.id,
        isActive: true,
      },
    });
  }

  const clientKey = 'hs_cli_' + crypto.randomBytes(24).toString('hex');
  await prisma.apiKey.upsert({
    where: { key: clientKey },
    update: {},
    create: {
      key: clientKey,
      name: 'mcp-e2e-client',
      userId: user.id,
      providerId: profile.id,
      isActive: true,
    },
  });

  console.log(JSON.stringify({
    providerId: profile.id,
    providerKey: profile.key,
    clientKey,
    userId: user.id,
  }));

  await prisma.\$disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });
" 2>/dev/null
