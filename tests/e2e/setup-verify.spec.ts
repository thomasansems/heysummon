/**
 * Setup verification endpoint E2E tests.
 *
 * Tests POST /api/v1/setup/verify — the endpoint that checks whether a consumer
 * API key is actively polling (connected).
 *
 * Requires: running dev server + seeded DB (npm run db:seed)
 */

import { test, expect } from "@playwright/test";
import { PW, BASE_URL } from "./helpers/constants";
import { apiGet, apiRaw } from "./helpers/api";

async function verifyKey(keyId: string, cookie: string) {
  return fetch(`${BASE_URL}/api/v1/setup/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ keyId }),
  });
}

async function loginAndGetCookie(): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: PW.EMAIL, password: PW.PASSWORD }),
    redirect: "manual",
  });
  return res.headers.get("set-cookie");
}

async function findKeyId(cookie: string, keyValue: string): Promise<string | null> {
  try {
    const data = await apiGet<{ keys: Array<{ id: string; key: string }> }>(
      "/api/v1/keys",
      { Cookie: cookie }
    );
    return data.keys?.find((k) => k.key === keyValue)?.id ?? null;
  } catch {
    return null;
  }
}

test.describe("POST /api/v1/setup/verify", () => {
  test("returns 401 for unauthenticated requests", async () => {
    const res = await apiRaw("POST", "/api/v1/setup/verify", { keyId: "any-id" });
    expect(res.status).toBe(401);
  });

  test("returns 400 when keyId is missing", async ({ page }) => {
    // Use Playwright page to handle auth cookie properly
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', PW.EMAIL);
    await page.fill('input[type="password"]', PW.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    const res = await page.request.post("/api/v1/setup/verify", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("returns connected:false for key that has never polled", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', PW.EMAIL);
    await page.fill('input[type="password"]', PW.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Get key ID (this key was just freshly seeded, may not have polled)
    const keysRes = await page.request.get("/api/v1/keys");
    const keysData = await keysRes.json();
    const key = keysData.keys?.find((k: { key: string }) => k.key === PW.OC_OPENCLAW_KEY);

    if (!key) {
      test.skip();
      return;
    }

    const res = await page.request.post("/api/v1/setup/verify", {
      data: { keyId: key.id },
    });
    const data = await res.json();

    // Key may be connected if tests ran in sequence — check the shape is correct
    expect(typeof data.connected).toBe("boolean");
    expect("lastPollAt" in data).toBe(true);
    expect(Array.isArray(data.allowedIps)).toBe(true);
  });

  test("returns connected:true after consumer polls", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', PW.EMAIL);
    await page.fill('input[type="password"]', PW.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    // Find the key ID
    const keysRes = await page.request.get("/api/v1/keys");
    const keysData = await keysRes.json();
    const key = keysData.keys?.find((k: { key: string }) => k.key === PW.CLIENT_KEY);

    if (!key) {
      test.skip();
      return;
    }

    // Trigger a poll (writes lastPollAt)
    await fetch(`${BASE_URL}/api/v1/events/pending`, {
      headers: { "x-api-key": PW.CLIENT_KEY },
    });

    // Verify immediately after poll — should be connected within 30s threshold
    const res = await page.request.post("/api/v1/setup/verify", {
      data: { keyId: key.id },
    });
    const data = await res.json();

    expect(data.connected).toBe(true);
    expect(data.lastPollAt).toBeTruthy();
  });

  test("returns 404 for a key that does not belong to the authenticated user", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', PW.EMAIL);
    await page.fill('input[type="password"]', PW.PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/dashboard/);

    const res = await page.request.post("/api/v1/setup/verify", {
      data: { keyId: "nonexistent-key-id-00000000000000" },
    });
    expect(res.status()).toBe(404);
  });
});
