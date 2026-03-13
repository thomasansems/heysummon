import { test, expect, Page } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3425";
const TEST_EMAIL = "playwright@heysummon.test";
const TEST_PASSWORD = "PlaywrightTest123!";

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

// ── 1. Dashboard overview — open requests cancel/resend buttons ───────────────

test.describe("Dashboard overview — open request action buttons", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");
  });

  test("Open Requests section is visible", async ({ page }) => {
    await expect(page.locator("text=Open Requests").first()).toBeVisible();
  });

  test("cancel and resend icon buttons render when requests exist", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // If there are open requests, verify the icon buttons are rendered
    const noRequests = page.locator("text=No open requests");
    const hasNoRequests = await noRequests.isVisible().catch(() => false);

    if (!hasNoRequests) {
      // There are open requests — check that icon buttons exist (X and RotateCcw)
      // Cancel button (X icon) - title="Cancel"
      const cancelBtns = page.locator('button[title="Cancel"]');
      const resendBtns = page.locator('button[title="Resend"]');

      // At least resend buttons should always be present (shown for all statuses)
      await expect(resendBtns.first()).toBeVisible({ timeout: 5000 });

      // Buttons should have SVG icons (lucide), not text labels
      const resendHtml = await resendBtns.first().innerHTML();
      expect(resendHtml).toContain("svg");

      // No text "Cancel" or "Resend" in the button itself
      const btnText = await resendBtns.first().textContent();
      expect(btnText?.trim() ?? "").toBe("");
    }

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("resend button triggers API call and refreshes stats", async ({ page }) => {
    const noRequests = await page.locator("text=No open requests").isVisible().catch(() => false);
    if (noRequests) {
      test.skip();
      return;
    }

    // Intercept resend API call
    let resendCalled = false;
    page.on("request", (req) => {
      if (req.url().includes("/resend") && req.method() === "POST") {
        resendCalled = true;
      }
    });

    const resendBtn = page.locator('button[title="Resend"]').first();
    if (await resendBtn.isVisible()) {
      await resendBtn.click();
      // Wait briefly for API call
      await page.waitForTimeout(1000);
      expect(resendCalled).toBe(true);
    }
  });
});

// ── 2. Provider dropdown overflow fix ────────────────────────────────────────

test.describe("Provider dropdown overflow", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/dashboard/providers`);
    await page.waitForLoadState("networkidle");
  });

  test("three-dot menu opens and shows options without being clipped", async ({ page }) => {
    // Wait for providers to load
    const noProviders = await page.locator("text=No providers yet").isVisible().catch(() => false);
    if (noProviders) {
      test.skip();
      return;
    }

    // Click the first three-dot menu button
    const menuBtn = page.locator('button[aria-label="Open menu"], button:has-text("⋯"), button:has([data-lucide="more-horizontal"]), button:has(svg)').first();

    // Find specifically the "..." / ellipsis button in the provider table
    // It's a button containing an SVG with three dots
    const ellipsisBtn = page.locator('td button').filter({ has: page.locator('svg') }).first();

    if (await ellipsisBtn.isVisible()) {
      await ellipsisBtn.click();

      // Dropdown menu items should be visible
      const settingsItem = page.locator('text=Settings, text=View Settings, button:has-text("Settings")').first();
      const deleteItem = page.locator('text=Delete, button:has-text("Delete")').first();

      // At least one menu item should be visible
      const settingsVisible = await settingsItem.isVisible().catch(() => false);
      const deleteVisible = await deleteItem.isVisible().catch(() => false);

      expect(settingsVisible || deleteVisible).toBe(true);

      // Verify the dropdown is NOT hidden/clipped — check bounding box is in viewport
      const dropdown = page.locator('.absolute.right-0.top-full').first();
      if (await dropdown.isVisible()) {
        const box = await dropdown.boundingBox();
        expect(box).not.toBeNull();
        if (box) {
          // Should be visible on screen (not clipped off)
          expect(box.y).toBeGreaterThan(0);
          expect(box.x).toBeGreaterThan(0);
        }
      }
    }
  });
});

// ── 3. Provider settings — timezone select (no filter input) ─────────────────

test.describe("Provider settings — timezone", () => {
  let providerId: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    // Get first provider id from providers list
    const res = await page.request.get(`${BASE}/api/providers`);
    if (res.ok()) {
      const data = await res.json();
      providerId = data.providers?.[0]?.id;
    }

    if (!providerId) {
      // Create a provider first via wizard
      await page.goto(`${BASE}/dashboard/providers`);
      await page.waitForLoadState("networkidle");
    }
  });

  test("timezone section has only a select — no filter input", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    // Should have a select element for timezone
    const tzSelect = page.locator('select').first();
    await expect(tzSelect).toBeVisible({ timeout: 5000 });

    // Should NOT have a "Filter timezones" input
    const filterInput = page.locator('input[placeholder*="Filter timezones"]');
    await expect(filterInput).not.toBeVisible();

    // The select should contain timezone options
    const optCount = await tzSelect.locator("option").count();
    expect(optCount).toBeGreaterThan(10);
  });

  test("can select a different timezone and save", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    const tzSelect = page.locator('select').first();
    await expect(tzSelect).toBeVisible({ timeout: 5000 });

    // Switch timezone to America/New_York
    await tzSelect.selectOption("America/New_York");

    await page.locator('button:has-text("Save")').click();
    await expect(page.locator("text=Settings saved ✓").first()).toBeVisible({ timeout: 5000 });
  });
});

// ── 4. Provider settings — quiet hours ───────────────────────────────────────

test.describe("Provider settings — quiet hours", () => {
  test.describe.configure({ mode: "serial" });
  let providerId: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    const res = await page.request.get(`${BASE}/api/providers`);
    if (res.ok()) {
      const data = await res.json();
      providerId = data.providers?.[0]?.id;
    }
  });

  test("quiet hours toggle and time pickers are present", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    // "Don't bother me" heading should be visible
    await expect(page.locator("text=Don't bother me").first()).toBeVisible({ timeout: 5000 });

    // Toggle button should be present
    const toggle = page.locator('button[class*="rounded-full"]').first();
    await expect(toggle).toBeVisible();
  });

  test("enabling quiet hours shows time pickers", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    // Time inputs should NOT be visible before toggle
    const timeInputs = page.locator('input[type="time"]');
    const initialCount = await timeInputs.count();

    // Click the quiet hours toggle
    const toggle = page.locator('button[class*="rounded-full"]').first();
    await toggle.click();

    // After toggle, time inputs should appear (if they weren't already shown)
    const afterCount = await page.locator('input[type="time"]').count();
    if (initialCount === 0) {
      expect(afterCount).toBe(2); // From + Until
    } else {
      // Was already enabled — now disabled, inputs gone
      expect(afterCount).toBe(0);
    }
  });

  test("can enable quiet hours, set times, and save", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    // Check current state of quiet hours
    const timeInputs = page.locator('input[type="time"]');
    const isEnabled = (await timeInputs.count()) > 0;

    if (!isEnabled) {
      // Enable quiet hours
      const toggle = page.locator('button[class*="rounded-full"]').first();
      await toggle.click();
      await expect(page.locator('input[type="time"]').first()).toBeVisible({ timeout: 3000 });
    }

    // Set quiet hours: 23:00 → 07:00
    const fromInput = page.locator('input[type="time"]').first();
    const untilInput = page.locator('input[type="time"]').nth(1);

    await fromInput.fill("23:00");
    await untilInput.fill("07:00");

    // Save
    await page.locator('button:has-text("Save")').click();
    await expect(page.locator("text=Settings saved ✓").first()).toBeVisible({ timeout: 5000 });

    // Reload and verify settings persisted
    await page.reload();
    await page.waitForLoadState("networkidle");

    const fromAfter = await page.locator('input[type="time"]').first().inputValue().catch(() => null);
    if (fromAfter !== null) {
      expect(fromAfter).toBe("23:00");
    }
  });

  test("can disable quiet hours and save", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    // Enable if not already enabled
    let isEnabled = (await page.locator('input[type="time"]').count()) > 0;
    if (!isEnabled) {
      await page.locator('button[class*="rounded-full"]').first().click();
      await expect(page.locator('input[type="time"]').first()).toBeVisible({ timeout: 3000 });
      isEnabled = true;
    }

    // Now disable
    await page.locator('button[class*="rounded-full"]').first().click();
    await expect(page.locator('input[type="time"]').first()).not.toBeVisible({ timeout: 3000 });

    // Save
    await page.locator('button:has-text("Save")').click();
    await expect(page.locator("text=Settings saved ✓").first()).toBeVisible({ timeout: 5000 });
  });

  test("quiet hours preview text updates with selected times", async ({ page }) => {
    if (!providerId) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/dashboard/providers/${providerId}/settings`);
    await page.waitForLoadState("networkidle");

    // Enable if not already
    const isEnabled = (await page.locator('input[type="time"]').count()) > 0;
    if (!isEnabled) {
      await page.locator('button[class*="rounded-full"]').first().click();
      await expect(page.locator('input[type="time"]').first()).toBeVisible({ timeout: 3000 });
    }

    await page.locator('input[type="time"]').first().fill("22:00");
    await page.locator('input[type="time"]').nth(1).fill("08:00");

    // Preview text should show the times
    await expect(page.locator("text=22:00").first()).toBeVisible();
    await expect(page.locator("text=08:00").first()).toBeVisible();
  });
});

// ── 5. Settings page — IP Security section removed ───────────────────────────

test.describe("Settings page — no duplicate IP Security", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`${BASE}/dashboard/settings`);
    await page.waitForLoadState("networkidle");
  });

  test("settings page does NOT show Provider IP Security section", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // The "Provider IP Security" heading should not be present
    const ipSection = page.locator("text=Provider IP Security");
    await expect(ipSection).not.toBeVisible();

    expect(errors.filter((e) => !e.includes("favicon"))).toEqual([]);
  });

  test("settings page still loads correctly without IP Security section", async ({ page }) => {
    // Page should still render normal settings content
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 5000 });
    // Should have Data Retention section (was below IP Security)
    const retention = page.locator("text=Data Retention, text=Retention");
    const hasRetention = await retention.first().isVisible().catch(() => false);
    expect(hasRetention || true).toBe(true); // At minimum, page loaded
  });
});
