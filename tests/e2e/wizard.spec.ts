import { test, expect, Page } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3425";
// Dedicated playwright test account — created once via seed script
const TEST_EMAIL = "playwright@heysummon.test";
const TEST_PASSWORD = "PlaywrightTest123!";
const TEST_BOT_TOKEN = "123456789:AAFakeTokenForTestingPurposesOnly1234";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/auth/login`);
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

// ── Provider wizard ───────────────────────────────────────────────────────────

test.describe("Provider wizard", () => {
  test.beforeEach(async ({ page }) => {
    
    await login(page);
    await page.goto(`${BASE}/dashboard/providers`);
    await page.waitForLoadState("networkidle");
  });

  test("OpenClaw provider — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // Open wizard
    await page.locator('button:has-text("Add New Provider")').click();
    await expect(page.locator("text=Add New Provider").first()).toBeVisible();

    // Fill name
    await page.locator('input[placeholder*="Thomas"]').fill("Test Provider OpenClaw");

    // Select OpenClaw channel
    await page.locator('button:has-text("OpenClaw")').first().click();
    await expect(page.locator("text=How OpenClaw works")).toBeVisible();

    // Click Create Provider
    await page.locator('button:has-text("Create Provider")').click();
    await expect(page.locator("text=Provider created")).toBeVisible({ timeout: 10000 });

    // Verify step 3 shows instructions
    await expect(page.locator("text=Step 1").first()).toBeVisible();
    await expect(page.locator("text=provider key").first()).toBeVisible();

    // Close
    await page.locator('button:has-text("Done")').click();
    await page.waitForLoadState("networkidle");
    // Provider created — verify it exists in the list (may be off-screen, check DOM presence)
    await expect(page.locator("text=Test Provider OpenClaw").first()).toBeAttached({ timeout: 5000 });

    expect(errors).toEqual([]);
  });

  test("Telegram Bot provider — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.locator('button:has-text("Add New Provider")').click();
    await page.locator('input[placeholder*="Thomas"]').fill("Test Provider Telegram");

    // Select Telegram Bot
    await page.locator('button:has-text("Telegram Bot")').click();
    await expect(page.locator('input[placeholder*="123456789"]')).toBeVisible();

    // Fill bot token
    await page.locator('input[placeholder*="123456789"]').fill(TEST_BOT_TOKEN);

    // Submit
    await page.locator('button:has-text("Create Provider")').click();

    // Either success or channel error (bot token is fake)
    await page.waitForTimeout(3000);
    const hasDone = await page.locator("text=Provider created").isVisible();
    const hasError = await page.locator("text=Failed to create channel").isVisible()
      || await page.locator('[class*="red"]').isVisible();

    // With fake token, channel creation may fail — but at minimum no 500 crash
    expect(hasDone || hasError).toBe(true);
    expect(errors.filter(e => e.includes("500") || e.includes("TypeError"))).toEqual([]);
  });
});

// ── Client wizard ─────────────────────────────────────────────────────────────

test.describe("Client wizard", () => {
  let providerName = "E2E Client Test Provider";

  test.beforeEach(async ({ page }) => {
    await login(page);

    // Ensure at least one provider exists by creating via dashboard
    await page.goto(`${BASE}/dashboard/providers`);
    await page.waitForLoadState("networkidle");
    const existingProvider = page.locator(`text=${providerName}`).first();
    if (!(await existingProvider.isVisible())) {
      // Use wizard to create provider
      await page.locator('button:has-text("Add New Provider")').click();
      await page.locator('input[placeholder*="Thomas"]').fill(providerName);
      await page.locator('button:has-text("OpenClaw")').first().click();
      await page.locator('button:has-text("Create Provider")').click();
      await page.waitForSelector("text=Provider created", { timeout: 10000 });
      await page.locator('button:has-text("Done")').click();
    }

    await page.goto(`${BASE}/dashboard/clients`);
    await page.waitForLoadState("networkidle");
  });

  test("OpenClaw + Telegram client — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    // Open wizard
    await page.locator('button:has-text("Create New Client")').click();
    await expect(page.locator("text=Create New Client").first()).toBeVisible();

    // Step 1: Select OpenClaw
    await page.locator('button:has-text("OpenClaw")').first().click();

    // Sub-channel: Telegram (scoped to sub-channel section to avoid matching OpenClaw description text)
    await expect(page.locator("text=Where does the client use OpenClaw")).toBeVisible();
    await page.locator('button:has-text("Telegram")').last().click();

    await page.locator('button:has-text("Next")').click();

    // Step 2: Details
    await expect(page.locator('input[placeholder*="John"]')).toBeVisible();
    await page.locator('input[placeholder*="John"]').fill("E2E OpenClaw Telegram Client");

    // Select provider
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 }); // first real provider

    await page.locator('button:has-text("Create Client")').click();

    // Step 3: Result
    await expect(page.locator("text=Client created")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Setup link").first()).toBeVisible();
    await expect(page.locator("text=valid for 24 hours")).toBeVisible();

    await page.locator('button:has-text("Done")').click();

    // Verify client appears in list with channel badge (may be off-screen)
    await expect(page.locator("text=OpenClaw").first()).toBeAttached({ timeout: 5000 });

    expect(errors.filter(e => !e.includes("favicon") && !e.includes("hydration"))).toEqual([]);
  });

  test("OpenClaw + WhatsApp client — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("OpenClaw")').first().click();

    await page.locator('button:has-text("WhatsApp")').last().click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[placeholder*="John"]').fill("E2E OpenClaw WhatsApp Client");
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 }); // first real provider

    await page.locator('button:has-text("Create Client")').click();
    await expect(page.locator("text=Client created")).toBeVisible({ timeout: 15000 });

    await page.locator('button:has-text("Done")').click();
    expect(errors.filter(e => !e.includes("favicon"))).toEqual([]);
  });

  test("Claude Code client — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("Claude Code")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[placeholder*="John"]').fill("E2E Claude Code Client");
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 }); // first real provider

    await page.locator('button:has-text("Create Client")').click();
    await expect(page.locator("text=Client created")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Setup link").first()).toBeVisible();

    await page.locator('button:has-text("Done")').click();
    expect(errors.filter(e => !e.includes("favicon"))).toEqual([]);
  });

  test("Codex CLI client — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("Codex CLI")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[placeholder*="John"]').fill("E2E Codex CLI Client");
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 });

    await page.locator('button:has-text("Create Client")').click();
    await expect(page.locator("text=Client created")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Setup link").first()).toBeVisible();

    await page.locator('button:has-text("Done")').click();
    expect(errors.filter(e => !e.includes("favicon"))).toEqual([]);
  });

  test("Gemini CLI client — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("Gemini CLI")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[placeholder*="John"]').fill("E2E Gemini CLI Client");
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 });

    await page.locator('button:has-text("Create Client")').click();
    await expect(page.locator("text=Client created")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Setup link").first()).toBeVisible();

    await page.locator('button:has-text("Done")').click();
    expect(errors.filter(e => !e.includes("favicon"))).toEqual([]);
  });

  test("Cursor client — full wizard flow", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("Cursor")').click();
    await page.locator('button:has-text("Next")').click();

    await page.locator('input[placeholder*="John"]').fill("E2E Cursor Client");
    const select = page.locator('select').first();
    await select.selectOption({ index: 1 });

    await page.locator('button:has-text("Create Client")').click();
    await expect(page.locator("text=Client created")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Setup link").first()).toBeVisible();

    await page.locator('button:has-text("Done")').click();
    expect(errors.filter(e => !e.includes("favicon"))).toEqual([]);
  });

  test("wizard shows error on missing provider", async ({ page }) => {
    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("OpenClaw")').first().click();
    await page.locator('button:has-text("Telegram")').last().click();
    await page.locator('button:has-text("Next")').click();

    // Don't select a provider — Create button should be disabled
    const createBtn = page.locator('button:has-text("Create Client")');
    await expect(createBtn).toBeDisabled();
  });

  test("wizard shows error on missing sub-channel for OpenClaw", async ({ page }) => {
    await page.locator('button:has-text("Create New Client")').click();
    await page.locator('button:has-text("OpenClaw")').first().click();

    // Don't pick Telegram/WhatsApp — Next should be disabled
    const nextBtn = page.locator('button:has-text("Next")');
    await expect(nextBtn).toBeDisabled();
  });
});
