/**
 * Require a secret from environment variables.
 * In production, throws if the secret is missing.
 * In development/test, falls back to a default value.
 */
export function requireSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} must be set in production`);
  }

  return devFallback;
}
