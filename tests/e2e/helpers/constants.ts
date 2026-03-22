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

  /** Mock Telegram bot token (seeded) */
  TELEGRAM_BOT_TOKEN: "999999999:PLAYWRIGHT_TEST_BOT_TOKEN_000000000",
  TELEGRAM_PROVIDER_CHAT_ID: "123456789",
} as const;

export const BASE_URL = process.env.BASE_URL || "http://localhost:3425";
