import { test, expect } from "@playwright/test";

test.describe("Channels", () => {
  // Unauthenticated redirect tests
  test("channels page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/channels");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("new channel page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/channels/new");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("channel settings page redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard/channels/some-id/settings");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});

test.describe("Channels API", () => {
  test("GET /api/channels returns 401 for unauthenticated requests", async ({ request }) => {
    const response = await request.get("/api/channels");
    expect(response.status()).toBe(401);
  });

  test("POST /api/channels returns 401 for unauthenticated requests", async ({ request }) => {
    const response = await request.post("/api/channels", {
      data: { type: "openclaw", name: "Test", config: {} },
    });
    expect(response.status()).toBe(401);
  });
});
