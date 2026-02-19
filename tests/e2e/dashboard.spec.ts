import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  // These tests would need auth mocking for full coverage
  // For now, test the redirect behavior
  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("keys page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard/keys");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("requests page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard/requests");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("settings page redirects to login when not authenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
