import { PrismaClient } from "@prisma/client";
import { randomBytes, generateKeyPairSync } from "crypto";

const prisma = new PrismaClient();

async function main() {
  // Create test user (Thomas)
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

  console.log(`✅ User created/found: ${user.email} (${user.id})`);

  // Create a test API key
  const existingKey = await prisma.apiKey.findFirst({
    where: { userId: user.id, name: "test-key" },
  });

  if (!existingKey) {
    const key = `htl_${randomBytes(24).toString("hex")}`;
    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        name: "test-key",
        userId: user.id,
        isActive: true,
      },
    });
    console.log(`✅ Test API key created: ${apiKey.key}`);
  } else {
    console.log(`✅ Test API key exists: ${existingKey.key}`);
  }

  // Create a sample help request with ref code
  const apiKey = await prisma.apiKey.findFirst({ where: { userId: user.id } });
  if (apiKey) {
    const existingReq = await prisma.helpRequest.findFirst({
      where: { expertId: user.id },
    });
    if (!existingReq) {
      // Generate key pairs for the sample request
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

      const req = await prisma.helpRequest.create({
        data: {
          refCode: "HTL-TEST",
          apiKeyId: apiKey.id,
          expertId: user.id,
          messages: JSON.stringify([
            { role: "user", content: "Can you set up JWT auth for my Next.js API?" },
            { role: "assistant", content: "Let me try... I'm getting an error with jwt.verify()" },
          ]),
          question: "JWT verify fails with secretOrPublicKey error",
          status: "pending",
          consumerPublicKey: consumerKp.publicKey as string,
          serverPublicKey: serverKp.publicKey as string,
          serverPrivateKey: serverKp.privateKey as string,
          webhookUrl: "https://example.com/hitlaas/callback",
          webhookSecret: randomBytes(32).toString("hex"),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      console.log(`✅ Sample help request created: ${req.refCode}`);
    } else {
      console.log(`✅ Sample help request exists: ${existingReq.refCode}`);
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
