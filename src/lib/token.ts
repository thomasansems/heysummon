import { createHmac } from "node:crypto";

const SECRET = process.env.VERIFY_SECRET || "hitlaas-default-secret-change-me";

export function createVerifyToken(email: string): string {
  const payload = Buffer.from(JSON.stringify({ email, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): { email: string; ts: number } | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, sig] = parts;
  const expectedSig = createHmac("sha256", SECRET).update(payload).digest("base64url");

  if (sig !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    // Token expires after 24 hours
    if (Date.now() - data.ts > 24 * 60 * 60 * 1000) return null;
    return data;
  } catch {
    return null;
  }
}
