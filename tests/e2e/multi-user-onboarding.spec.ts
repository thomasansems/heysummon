import { test, expect, Page } from "@playwright/test";
import { BASE_URL, PW } from "./helpers/constants";

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector("#email", { timeout: 10000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

/**
 * HEY-226 / HEY-252: Multi-user dashboard onboarding loop.
 *
 * When the platform is already configured (at least one expert and one API key
 * exist globally), a second user with `onboardingComplete=false` must land on
 * `/dashboard` directly — not be bounced to `/onboarding`.
 */
test.describe("Multi-user onboarding — HEY-226", () => {
  test("second user (onboardingComplete=false) lands on /dashboard, never visits /onboarding", async ({ page }) => {
    const visitedOnboarding: string[] = [];
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame() && frame.url().includes("/onboarding")) {
        visitedOnboarding.push(frame.url());
      }
    });

    await login(page, PW.SECOND_EMAIL, PW.SECOND_PASSWORD);

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

    // Give OnboardingGuard time to finish its fetch and settle
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/dashboard/);

    expect(visitedOnboarding, `URL should never visit /onboarding: ${visitedOnboarding.join(", ")}`).toHaveLength(0);
  });

  test("second user's onboardingComplete is auto-flipped to true by status route", async ({ page }) => {
    await login(page, PW.SECOND_EMAIL, PW.SECOND_PASSWORD);

    const res = await page.request.get(`${BASE_URL}/api/onboarding/status`);
    expect(res.ok()).toBe(true);
    const data = await res.json();

    expect(data).toMatchObject({
      onboardingComplete: true,
      hasExpert: true,
      hasClient: true,
    });
    expect(data.expertCount).toBeGreaterThan(0);
    expect(data.clientCount).toBeGreaterThan(0);
  });
});
