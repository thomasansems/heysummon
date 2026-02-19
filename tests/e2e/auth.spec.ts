import { test, expect } from "@playwright/test";

test.describe("Auth Page", () => {
  test("login page renders OAuth buttons", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Continue with GitHub")).toBeVisible();
    await expect(page.getByText("Continue with Google")).toBeVisible();
  });

  test("login page shows welcome message", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
  });

  test("login page has auto-signup notice", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(
      page.getByText("New here? We'll create your account automatically.")
    ).toBeVisible();
  });

  test("login page has no password field", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[type="password"]')).not.toBeVisible();
  });

  test("unauthenticated dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
