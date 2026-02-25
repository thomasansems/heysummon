import { test, expect, Page } from "@playwright/test";

const TEST_EMAIL = "demo@heysummon.ai";
const TEST_PASSWORD = "demo1234";

async function login(page: Page) {
  await page.goto("/auth/login");
  // Wait for the form to be fully rendered (React hydration)
  await page.waitForSelector('#email', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1000); // Allow React hydration

  // Ensure we're in login mode (not register) by checking for "Sign in" button
  const signInBtn = page.locator('button[type="submit"]:has-text("Sign in")');
  const createBtn = page.locator('button[type="submit"]:has-text("Create account")');

  // If we see "Create account", click "Sign in" link to switch to login mode
  if (await createBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.locator('button:has-text("Sign in"), a:has-text("Sign in")').first().click();
    await page.waitForTimeout(500);
  }

  await page.locator('#email').clear();
  await page.locator('#email').fill(TEST_EMAIL);
  await page.locator('#password').clear();
  await page.locator('#password').fill(TEST_PASSWORD);

  // Click the Sign in button specifically
  await signInBtn.click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

test.describe("Dashboard Walkthrough", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("Overview page loads without errors", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible();
    // Check no error toasts or 500 errors
    await expect(page.locator("text=500")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
  });

  test("Navigate to Users page", async ({ page }) => {
    await page.click('nav >> text=Users');
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=500")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
  });

  test("Navigate to Channels page", async ({ page }) => {
    await page.click('nav >> text=Channels');
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=500")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
  });

  test("Navigate to Channels > New Channel page", async ({ page }) => {
    await page.click('nav >> text=Channels');
    await page.waitForLoadState("domcontentloaded");
    // Click "New Channel" or "Add Channel" button
    const newBtn = page.locator('a:has-text("New Channel"), button:has-text("New Channel"), a:has-text("Add Channel")');
    if (await newBtn.isVisible()) {
      await newBtn.first().click();
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("text=Choose the type")).toBeVisible();
      // Verify channel type cards are visible
      await expect(page.locator("text=OpenClaw")).toBeVisible();
      await expect(page.locator("text=Telegram")).toBeVisible();
      await expect(page.locator("text=WhatsApp")).toBeVisible();
    }
  });

  test("Navigate to Clients page", async ({ page }) => {
    await page.click('nav >> text=Clients');
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=500")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
  });

  test("Navigate to Requests page", async ({ page }) => {
    await page.click('nav >> text=Requests');
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=500")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
  });

  test("Navigate to Audit Logs page", async ({ page }) => {
    await page.click('nav >> text=Audit Logs');
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("text=500")).not.toBeVisible();
    await expect(page.locator("text=Internal Server Error")).not.toBeVisible();
  });

  test("Navigate to Settings page", async ({ page }) => {
    await page.click('nav >> text=Settings');
    await page.waitForLoadState("domcontentloaded");
    // Verify profile section is visible
    await expect(page.locator("text=Profile")).toBeVisible();
    await expect(page.locator("text=Notifications")).toBeVisible();
    // Expertise should NOT be visible (we removed it)
    await expect(page.locator("text=Expertise")).not.toBeVisible();
  });

  test("Full navigation walkthrough - click every menu item", async ({ page }) => {
    const menuItems = ["Overview", "Users", "Channels", "Clients", "Requests", "Audit Logs", "Settings"];
    const errors: string[] = [];

    for (const item of menuItems) {
      try {
        // Click nav item
        const navLink = page.locator(`nav >> text=${item}`).first();
        if (await navLink.isVisible()) {
          await navLink.click();
          await page.waitForLoadState("domcontentloaded");

          // Check for errors
          const has500 = await page.locator("text=500").isVisible();
          const hasServerError = await page.locator("text=Internal Server Error").isVisible();
          const hasTypeError = await page.locator("text=TypeError").isVisible();

          if (has500 || hasServerError || hasTypeError) {
            errors.push(`${item}: Error visible on page`);
          }

          // Check console errors
          page.on("console", (msg) => {
            if (msg.type() === "error" && !msg.text().includes("favicon")) {
              errors.push(`${item} console error: ${msg.text()}`);
            }
          });
        } else {
          errors.push(`${item}: Nav link not visible`);
        }
      } catch (e) {
        errors.push(`${item}: ${(e as Error).message}`);
      }
    }

    expect(errors).toEqual([]);
  });
});
