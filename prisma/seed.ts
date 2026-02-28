import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Demo user (tijdelijk voor development)
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
    const key = `hs_${randomBytes(24).toString("hex")}`;
    const apiKey = await prisma.apiKey.create({
      data: { key, name: "test-key", userId: demoUser.id, isActive: true },
    });
    console.log(`✅ API key created: ${apiKey.key.slice(0, 10)}...`);
  } else {
    console.log(`✅ API key exists: ${existingKey.key.slice(0, 10)}...`);
  }

  const apiKey = await prisma.apiKey.findFirst({ where: { userId: demoUser.id } });
  if (apiKey) {
    const existingReq = await prisma.helpRequest.findFirst({ where: { expertId: demoUser.id } });
    if (!existingReq) {
      const req = await prisma.helpRequest.create({
        data: {
          refCode: "HS-TEST",
          apiKeyId: apiKey.id,
          expertId: demoUser.id,
          status: "pending",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      console.log(`✅ Sample request: ${req.refCode}`);
    }
  }

  // Create a sample UserProfile
  const existingProfile = await prisma.userProfile.findFirst({
    where: { userId: demoUser.id },
  });
  let profile;
  if (!existingProfile) {
    profile = await prisma.userProfile.create({
      data: {
        name: "My Workspace",
        key: `hs_prov_${randomBytes(16).toString("hex")}`,
        userId: demoUser.id,
        isActive: true,
        timezone: "Europe/Amsterdam",
      },
    });
    console.log(`✅ UserProfile: ${profile.name} (${profile.id})`);
  } else {
    profile = existingProfile;
    console.log(`✅ UserProfile exists: ${profile.name}`);
  }

  // Create sample ChannelProviders
  const existingChannel = await prisma.channelProvider.findFirst({
    where: { profileId: profile.id },
  });
  if (!existingChannel) {
    const openclawChannel = await prisma.channelProvider.create({
      data: {
        profileId: profile.id,
        type: "openclaw",
        name: "Dev OpenClaw",
        isActive: true,
        config: JSON.stringify({ apiKey: "oc_demo_key_123" }),
        status: "connected",
      },
    });
    console.log(`✅ ChannelProvider (OpenClaw): ${openclawChannel.name}`);

    const telegramChannel = await prisma.channelProvider.create({
      data: {
        profileId: profile.id,
        type: "telegram",
        name: "Support Bot",
        isActive: false,
        config: JSON.stringify({ botToken: "123456:ABC-DEF", botUsername: "heysummon_bot" }),
        status: "disconnected",
      },
    });
    console.log(`✅ ChannelProvider (Telegram): ${telegramChannel.name}`);
  } else {
    console.log(`✅ ChannelProviders exist for profile`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
