import { test, expect } from "@playwright/test";

test.describe("Keys Page", () => {
  test("redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard/keys");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
