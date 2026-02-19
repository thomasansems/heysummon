import { test, expect } from "@playwright/test";

test.describe("Requests Page", () => {
  test("redirects unauthenticated users", async ({ page }) => {
    await page.goto("/dashboard/requests");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
