import { prisma } from "./prisma";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function generateRefCode(): string {
  let code = "HTL-";
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function generateUniqueRefCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateRefCode();
    const existing = await prisma.helpRequest.findUnique({
      where: { refCode: code },
    });
    if (!existing) return code;
  }
  throw new Error("Failed to generate unique ref code after 10 attempts");
}
