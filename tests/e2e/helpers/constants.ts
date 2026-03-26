/** Deterministic Playwright test account constants — created by prisma/seed.ts */
export const PW = {
  EMAIL: "playwright@heysummon.test",
  PASSWORD: "PlaywrightTest123!",

  PROVIDER_KEY: "hs_prov_playwright00000000000000000001",

  /** Base lifecycle test key */
  CLIENT_KEY: "hs_cli_playwright00000000000000000001",

  /** Channel combination keys */
  OC_TELEGRAM_KEY: "hs_cli_pw_openclaw_telegram_00000001",
  OC_OPENCLAW_KEY: "hs_cli_pw_openclaw_openclaw_0000001",
  CC_OPENCLAW_KEY: "hs_cli_pw_claudecode_openclaw_000001",
  CC_TELEGRAM_KEY: "hs_cli_pw_claudecode_telegram_00001",
  OC_SLACK_KEY: "hs_cli_pw_openclaw_slack_000000001",
  CC_SLACK_KEY: "hs_cli_pw_claudecode_slack_00000001",

  /** Mock Telegram bot token (seeded) */
  TELEGRAM_BOT_TOKEN: "999999999:PLAYWRIGHT_TEST_BOT_TOKEN_000000000",
  TELEGRAM_PROVIDER_CHAT_ID: "123456789",

  /** Mock Slack credentials (seeded) */
  SLACK_BOT_TOKEN: "xoxb-999999999999-9999999999999-PLAYWRIGHT_TEST",
  SLACK_SIGNING_SECRET: "pw_slack_signing_secret_000000000000",
  SLACK_CHANNEL_ID: "C00PW00TEST",
} as const;

// Read URLs from environment (GitHub Actions) or use defaults (local dev)
const rawBaseUrl = process.env.BASE_URL || "http://localhost:3425";
const rawGuardUrl = process.env.GUARD_URL; // Only set if explicitly passed

export const BASE_URL = rawBaseUrl;

/**
 * Guard URL — used when REQUIRE_GUARD=true in CI.
 * In CI, this is set separately (http://localhost:3457).
 * In local dev, defaults to BASE_URL (REQUIRE_GUARD=false).
 */
export const GUARD_URL = rawGuardUrl || BASE_URL;

// Debug: log the URLs being used (visible in test output)
if (typeof console !== "undefined") {
  console.log(`[PW Constants] BASE_URL=${BASE_URL}`);
  console.log(`[PW Constants] GUARD_URL=${GUARD_URL}`);
  if (rawGuardUrl) {
    console.log(`[PW Constants] Using Guard proxy (REQUIRE_GUARD=true mode)`);
  }
}
