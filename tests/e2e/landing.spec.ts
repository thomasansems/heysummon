import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("renders main heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("has navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav")).toBeVisible();
  });

  test("has HITLaaS branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("HITLaaS")).toBeVisible();
  });
});
