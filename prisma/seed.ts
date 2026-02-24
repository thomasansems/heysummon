import { PrismaClient } from "@prisma/client";
import { randomBytes, generateKeyPairSync, publicEncrypt, createCipheriv, constants } from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function encryptMessage(plaintext: string, publicKey: string): string {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING },
    aesKey
  );
  return [
    encryptedKey.toString("base64"),
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

async function main() {
  // Demo user (tijdelijk voor development)
  const demoPassword = await bcrypt.hash("demo1234", 12);
  const demoUser = await prisma.user.upsert({
    where: { email: "demo@heysummon.com" },
    update: {},
    create: {
      email: "demo@heysummon.com",
      name: "Demo User",
      password: demoPassword,
      role: "expert",
      onboardingComplete: true,
      expertise: JSON.stringify(["debugging", "frontend"]),
      notificationPref: "email",
    },
  });
  console.log(`✅ Demo user: ${demoUser.email} / demo1234`);

  const user = await prisma.user.upsert({
    where: { email: "thomasansems@gmail.com" },
    update: {},
    create: {
      email: "thomasansems@gmail.com",
      name: "Thomas Ansems",
      role: "expert",
      onboardingComplete: true,
      expertise: JSON.stringify(["debugging", "architecture", "devops", "frontend", "backend"]),
      notificationPref: "telegram",
    },
  });
  console.log(`✅ User: ${user.email} (${user.id})`);

  const existingKey = await prisma.apiKey.findFirst({
    where: { userId: user.id, name: "test-key" },
  });
  if (!existingKey) {
    const key = `hs_${randomBytes(24).toString("hex")}`;
    const apiKey = await prisma.apiKey.create({
      data: { key, name: "test-key", userId: user.id, isActive: true },
    });
    console.log(`✅ API key: ${apiKey.key}`);
  } else {
    console.log(`✅ API key exists: ${existingKey.key}`);
  }

  const apiKey = await prisma.apiKey.findFirst({ where: { userId: user.id } });
  if (apiKey) {
    const existingReq = await prisma.helpRequest.findFirst({ where: { expertId: user.id } });
    if (!existingReq) {
      const serverKp = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });
      const consumerKp = generateKeyPairSync("rsa", {
        modulusLength: 2048,
        publicKeyEncoding: { type: "spki", format: "pem" },
        privateKeyEncoding: { type: "pkcs8", format: "pem" },
      });

      const messages = [
        { role: "user", content: "Can you set up JWT auth for my Next.js API?" },
        { role: "assistant", content: "Let me try... I'm getting an error with jwt.verify()" },
      ];

      const req = await prisma.helpRequest.create({
        data: {
          refCode: "HS-TEST",
          apiKeyId: apiKey.id,
          expertId: user.id,
          messages: encryptMessage(JSON.stringify(messages), serverKp.publicKey as string),
          question: encryptMessage("JWT verify fails with secretOrPublicKey error", serverKp.publicKey as string),
          status: "pending",
          consumerPublicKey: consumerKp.publicKey as string,
          serverPublicKey: serverKp.publicKey as string,
          serverPrivateKey: serverKp.privateKey as string,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      console.log(`✅ Sample request: ${req.refCode}`);
    }
  }
}

  // Create a sample UserProfile
  const existingProfile = await prisma.userProfile.findFirst({
    where: { userId: user.id },
  });
  let profile;
  if (!existingProfile) {
    profile = await prisma.userProfile.create({
      data: {
        name: "My Workspace",
        key: `hs_prov_${randomBytes(16).toString("hex")}`,
        userId: user.id,
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
