import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── Demo user (for development) ─────────────────────────────────────────
  const demoPassword = await bcrypt.hash("demo1234", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@heysummon.ai" },
    update: {},
    create: {
      email: "demo@heysummon.ai",
      name: "Demo User",
      password: demoPassword,
      role: "expert",
      onboardingComplete: true,
      notificationPref: "email",
    },
  });
  console.log(`✅ Demo user: ${demoUser.email} / demo1234`);

  const existingKey = await prisma.apiKey.findFirst({
    where: { userId: demoUser.id, name: "test-key" },
  });
  if (!existingKey) {
    await prisma.apiKey.create({
      data: { key: `hs_${randomBytes(24).toString("hex")}`, name: "test-key", userId: demoUser.id, isActive: true },
    });
    console.log("✅ API key created");
  } else {
    console.log("✅ API key exists");
  }

  const demoApiKey = await prisma.apiKey.findFirst({ where: { userId: demoUser.id } });
  if (demoApiKey) {
    const existingReq = await prisma.helpRequest.findFirst({ where: { expertId: demoUser.id } });
    if (!existingReq) {
      await prisma.helpRequest.create({
        data: {
          refCode: "HS-TEST",
          apiKeyId: demoApiKey.id,
          expertId: demoUser.id,
          status: "pending",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      console.log("✅ Sample request: HS-TEST");
    }
  }

  let demoProfile = await prisma.userProfile.findFirst({ where: { userId: demoUser.id } });
  if (!demoProfile) {
    demoProfile = await prisma.userProfile.create({
      data: {
        name: "My Workspace",
        key: `hs_exp_${randomBytes(16).toString("hex")}`,
        userId: demoUser.id,
        isActive: true,
        timezone: "Europe/Amsterdam",
      },
    });
    console.log(`✅ UserProfile: ${demoProfile.name}`);
  } else {
    console.log(`✅ UserProfile exists: ${demoProfile.name}`);
  }

  const existingChannel = await prisma.expertChannel.findFirst({ where: { profileId: demoProfile.id } });
  if (!existingChannel) {
    await prisma.expertChannel.create({
      data: {
        profileId: demoProfile.id,
        type: "openclaw",
        name: "Dev OpenClaw",
        isActive: true,
        config: JSON.stringify({ apiKey: "oc_demo_key_123" }),
        status: "connected",
      },
    });
    await prisma.expertChannel.create({
      data: {
        profileId: demoProfile.id,
        type: "telegram",
        name: "Support Bot",
        isActive: false,
        config: JSON.stringify({ botToken: "123456:ABC-DEF", botUsername: "heysummon_bot" }),
        status: "disconnected",
      },
    });
    console.log("Expert channels created for demo profile");
  } else {
    console.log("Expert channels exist for demo profile");
  }

  // ─── Playwright test account ──────────────────────────────────────────────
  // Fixed deterministic keys — tests use these as constants without a discovery phase.
  // 127.0.0.1 is pre-approved to bypass IP binding friction in tests.

  const pwPassword = await bcrypt.hash("PlaywrightTest123!", 12);
  const pwUser = await prisma.user.upsert({
    where: { email: "playwright@heysummon.test" },
    update: {},
    create: {
      email: "playwright@heysummon.test",
      name: "Playwright Test",
      password: pwPassword,
      role: "expert",
      onboardingComplete: true,
      notificationPref: "email",
    },
  });
  console.log(`✅ Playwright user: ${pwUser.email}`);

  // Expert profile (used as the expert who receives requests)
  const pwProfile = await prisma.userProfile.upsert({
    where: { key: "hs_exp_playwright00000000000000000001" },
    update: {},
    create: {
      name: "PW Test Expert",
      key: "hs_exp_playwright00000000000000000001",
      userId: pwUser.id,
      isActive: true,
      timezone: "Europe/Amsterdam",
    },
  });
  console.log(`✅ Playwright expert profile: ${pwProfile.name}`);

  // Base lifecycle test client key
  const pwBaseKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_playwright00000000000000000001" },
    update: {},
    create: {
      key: "hs_cli_playwright00000000000000000001",
      name: "PW Base Test",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "openclaw",
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwBaseKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwBaseKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwBaseKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwBaseKey.id, ip: "::1", status: "allowed" },
  });
  console.log(`✅ Playwright base client key`);

  // Channel combo 1: OpenClaw consumer → Telegram expert notification
  const pwOcTelegramKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_pw_openclaw_telegram_00000001" },
    update: {},
    create: {
      key: "hs_cli_pw_openclaw_telegram_00000001",
      name: "PW OpenClaw→Telegram",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "openclaw",
      clientSubChannel: "telegram",
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwOcTelegramKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwOcTelegramKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwOcTelegramKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwOcTelegramKey.id, ip: "::1", status: "allowed" },
  });

  // Channel combo 2: OpenClaw consumer → OpenClaw expert notification (pure polling)
  const pwOcOpenclawKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_pw_openclaw_openclaw_0000001" },
    update: {},
    create: {
      key: "hs_cli_pw_openclaw_openclaw_0000001",
      name: "PW OpenClaw→OpenClaw",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "openclaw",
      clientSubChannel: null,
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwOcOpenclawKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwOcOpenclawKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwOcOpenclawKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwOcOpenclawKey.id, ip: "::1", status: "allowed" },
  });

  // Channel combo 3: Claude Code consumer → OpenClaw expert notification
  const pwCcOpenclawKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_pw_claudecode_openclaw_000001" },
    update: {},
    create: {
      key: "hs_cli_pw_claudecode_openclaw_000001",
      name: "PW ClaudeCode→OpenClaw",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "claudecode",
      clientSubChannel: null,
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwCcOpenclawKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwCcOpenclawKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwCcOpenclawKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwCcOpenclawKey.id, ip: "::1", status: "allowed" },
  });

  // Channel combo 4: Claude Code consumer → Telegram expert notification
  const pwCcTelegramKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_pw_claudecode_telegram_00001" },
    update: {},
    create: {
      key: "hs_cli_pw_claudecode_telegram_00001",
      name: "PW ClaudeCode→Telegram",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "claudecode",
      clientSubChannel: "telegram",
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwCcTelegramKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwCcTelegramKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwCcTelegramKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwCcTelegramKey.id, ip: "::1", status: "allowed" },
  });

  // Channel combo 5: OpenClaw consumer → Slack expert notification
  const pwOcSlackKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_pw_openclaw_slack_000000001" },
    update: {},
    create: {
      key: "hs_cli_pw_openclaw_slack_000000001",
      name: "PW OpenClaw→Slack",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "openclaw",
      clientSubChannel: null,
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwOcSlackKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwOcSlackKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwOcSlackKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwOcSlackKey.id, ip: "::1", status: "allowed" },
  });

  // Channel combo 6: Claude Code consumer → Slack expert notification
  const pwCcSlackKey = await prisma.apiKey.upsert({
    where: { key: "hs_cli_pw_claudecode_slack_00000001" },
    update: {},
    create: {
      key: "hs_cli_pw_claudecode_slack_00000001",
      name: "PW ClaudeCode→Slack",
      userId: pwUser.id,
      expertId: pwProfile.id,
      isActive: true,
      clientChannel: "claudecode",
      clientSubChannel: null,
      rateLimitPerMinute: 1000,
    },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwCcSlackKey.id, ip: "127.0.0.1" } },
    update: {},
    create: { apiKeyId: pwCcSlackKey.id, ip: "127.0.0.1", status: "allowed" },
  });
  await prisma.ipEvent.upsert({
    where: { apiKeyId_ip: { apiKeyId: pwCcSlackKey.id, ip: "::1" } },
    update: {},
    create: { apiKeyId: pwCcSlackKey.id, ip: "::1", status: "allowed" },
  });

  console.log(`✅ Playwright channel combination keys (6 total)`);

  // Mock Telegram channel for pw profile (used in Telegram notification tests)
  const existingTelegramChannel = await prisma.expertChannel.findFirst({
    where: { profileId: pwProfile.id, type: "telegram" },
  });
  if (!existingTelegramChannel) {
    await prisma.expertChannel.create({
      data: {
        profileId: pwProfile.id,
        type: "telegram",
        name: "PW Test Telegram Bot",
        isActive: true,
        config: JSON.stringify({
          botToken: "999999999:PLAYWRIGHT_TEST_BOT_TOKEN_000000000",
          botUsername: "heysummon_pw_test_bot",
          expertChatId: "123456789",
        }),
        status: "connected",
      },
    });
    console.log("✅ Playwright Telegram channel (mock)");
  } else {
    console.log("✅ Playwright Telegram channel exists");
  }

  // Mock Slack channel for pw profile (used in Slack notification tests)
  const existingSlackChannel = await prisma.expertChannel.findFirst({
    where: { profileId: pwProfile.id, type: "slack" },
  });
  if (!existingSlackChannel) {
    await prisma.expertChannel.create({
      data: {
        profileId: pwProfile.id,
        type: "slack",
        name: "PW Test Slack Channel",
        isActive: true,
        config: JSON.stringify({
          botToken: "xoxb-999999999999-9999999999999-PLAYWRIGHT_TEST",
          signingSecret: "pw_slack_signing_secret_000000000000",
          channelId: "C00PW00TEST",
          teamId: "T00PW00TEST",
          teamName: "PW Test Workspace",
          botUserId: "U00PW00BOT",
        }),
        status: "connected",
      },
    });
    console.log("✅ Playwright Slack channel (mock)");
  } else {
    console.log("✅ Playwright Slack channel exists");
  }

  // OpenClaw channel for pw profile (used in OpenClaw polling tests)
  const existingOcChannel = await prisma.expertChannel.findFirst({
    where: { profileId: pwProfile.id, type: "openclaw" },
  });
  if (!existingOcChannel) {
    await prisma.expertChannel.create({
      data: {
        profileId: pwProfile.id,
        type: "openclaw",
        name: "PW Test OpenClaw",
        isActive: true,
        config: JSON.stringify({ apiKey: "oc_pw_test_key" }),
        status: "connected",
      },
    });
    console.log("✅ Playwright OpenClaw channel (mock)");
  } else {
    console.log("✅ Playwright OpenClaw channel exists");
  }

  console.log("\n📋 Playwright test constants:");
  console.log(`   User:          playwright@heysummon.test / PlaywrightTest123!`);
  console.log(`   Expert key:    hs_exp_playwright00000000000000000001`);
  console.log(`   Base key:      hs_cli_playwright00000000000000000001`);
  console.log(`   OC→Telegram:   hs_cli_pw_openclaw_telegram_00000001`);
  console.log(`   OC→OpenClaw:   hs_cli_pw_openclaw_openclaw_0000001`);
  console.log(`   CC→OpenClaw:   hs_cli_pw_claudecode_openclaw_000001`);
  console.log(`   CC→Telegram:   hs_cli_pw_claudecode_telegram_00001`);
  console.log(`   OC→Slack:      hs_cli_pw_openclaw_slack_000000001`);
  console.log(`   CC→Slack:      hs_cli_pw_claudecode_slack_00000001`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
