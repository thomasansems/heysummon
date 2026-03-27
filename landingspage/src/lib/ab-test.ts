/**
 * Cookie-based A/B test assignment for the landing page experiment.
 *
 * On first visit, a visitor is randomly assigned to "control" or "variant"
 * with 50/50 probability. The assignment is stored in a persistent cookie
 * so returning visitors always see the same version.
 *
 * Non-negotiable design decisions (per experiment plan):
 * - Cookie-based random assignment (URL-path splitting introduces selection bias)
 * - CTA copy stays identical between variants
 * - Variant tag is attached to every analytics event
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ABVariant = 'control' | 'variant';

// ---------------------------------------------------------------------------
// Cookie helpers
// ---------------------------------------------------------------------------

const COOKIE_NAME = 'hs_ab_variant';
const COOKIE_MAX_AGE_DAYS = 90;

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days: number): void {
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// Assignment
// ---------------------------------------------------------------------------

function assignVariant(): ABVariant {
  return Math.random() < 0.5 ? 'control' : 'variant';
}

/**
 * Get the current visitor's A/B variant.
 * Assigns one on first call and persists it in a cookie.
 */
export function getVariant(): ABVariant {
  const existing = getCookie(COOKIE_NAME);
  if (existing === 'control' || existing === 'variant') {
    return existing;
  }

  const variant = assignVariant();
  setCookie(COOKIE_NAME, variant, COOKIE_MAX_AGE_DAYS);
  return variant;
}

/**
 * Check whether this visitor is in the variant (B) group.
 * Convenience helper for conditional rendering.
 */
export function isVariant(): boolean {
  return getVariant() === 'variant';
}

/**
 * Force a specific variant (for testing/QA only).
 * Overwrites the cookie with the given variant.
 */
export function forceVariant(variant: ABVariant): void {
  setCookie(COOKIE_NAME, variant, COOKIE_MAX_AGE_DAYS);
}
