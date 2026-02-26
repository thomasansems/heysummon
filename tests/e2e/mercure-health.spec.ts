import { test, expect, Page } from "@playwright/test";

const TEST_EMAIL = "demo@heysummon.ai";
const TEST_PASSWORD = "demo1234";

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.waitForSelector("#email", { state: "visible", timeout: 10000 });
  await page.waitForTimeout(2000); // Allow full React hydration

  await page.locator("#email").fill(TEST_EMAIL);
  await page.locator("#password").fill(TEST_PASSWORD);

  await Promise.all([
    page.waitForURL(/\/dashboard|\/auth\/login/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);

  const url = page.url();
  if (url.includes("/auth/login")) {
    const errorText = await page
      .locator('[class*="error"], [role="alert"], .text-red')
      .textContent()
      .catch(() => "unknown");
    throw new Error(`Login failed. URL: ${url}, Error: ${errorText}`);
  }
}

test.describe("Mercure Health Status", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("shows Mercure health indicator on dashboard", async ({ page }) => {
    // Wait for health check to complete
    await page.waitForTimeout(1000);

    // Check health indicator exists
    const healthIndicator = page.locator('text=Real-time Server');
    await expect(healthIndicator).toBeVisible();

    // Check status dot exists (green or red)
    const statusDot = page.locator('.rounded-full').first();
    await expect(statusDot).toBeVisible();
  });

  test("health indicator shows connection status", async ({ page }) => {
    await page.waitForTimeout(1000);

    // Check for either "Connected" or "Disconnected" text
    const statusText = page.locator('text=/Connected|Disconnected/');
    await expect(statusText).toBeVisible();

    // Check timestamp exists
    const timestamp = page.locator('text=/Checked .* ago/');
    await expect(timestamp).toBeVisible();
  });

  test("shows warning banner when Mercure is down", async ({ page }) => {
    // Intercept health API and mock unhealthy response
    await page.route("**/api/mercure/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "unhealthy",
          mercureUrl: "http://localhost:3100",
          lastCheck: new Date().toISOString(),
          error: "Connection timeout",
        }),
      });
    });

    // Reload to trigger health check with mocked response
    await page.reload();
    await page.waitForTimeout(1000);

    // Check warning banner appears
    const warningBanner = page.locator('text=Real-time server is down');
    await expect(warningBanner).toBeVisible();

    // Check error message shows
    const errorMessage = page.locator('text=/SSE notifications are not being delivered/');
    await expect(errorMessage).toBeVisible();
  });

  test("shows healthy status when Mercure is up", async ({ page }) => {
    // Intercept health API and mock healthy response
    await page.route("**/api/mercure/health", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "healthy",
          mercureUrl: "http://localhost:3100",
          lastCheck: new Date().toISOString(),
          responseTime: 42,
        }),
      });
    });

    await page.reload();
    await page.waitForTimeout(1000);

    // Check "Connected" status shows
    const connectedText = page.locator('text=Connected');
    await expect(connectedText).toBeVisible();

    // Check response time shows
    const responseTime = page.locator('text=/\\d+ms/');
    await expect(responseTime).toBeVisible();

    // Warning banner should NOT be visible
    const warningBanner = page.locator('text=Real-time server is down');
    await expect(warningBanner).not.toBeVisible();
  });

  test("API endpoint returns health data", async ({ page }) => {
    const baseUrl = process.env.BASE_URL || "http://localhost:3456";
    const response = await page.request.get(`${baseUrl}/api/mercure/health`);
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("mercureUrl");
    expect(data).toHaveProperty("lastCheck");
    expect(["healthy", "unhealthy"]).toContain(data.status);
  });
});
