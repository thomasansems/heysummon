import * as crypto from "crypto";

export function generateSecret(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function generateSecrets(): {
  nextauthSecret: string;
  mercureJwtSecret: string;
} {
  return {
    nextauthSecret: generateSecret(),
    mercureJwtSecret: generateSecret(),
  };
}
