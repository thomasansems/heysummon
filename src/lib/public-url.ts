/**
 * Returns the canonical public base URL for this HeySummon instance.
 *
 * Priority order:
 * 1. HEYSUMMON_PUBLIC_URL env var (set by Tailscale Funnel start / Cloudflare / manual config)
 * 2. x-forwarded-host / host request headers (behind a reverse proxy)
 * 3. Fallback: localhost:3425
 *
 * Always call this when generating any URL that will be shared externally:
 * - Setup links (magic links for clients)
 * - Telegram webhook registration
 * - Skill install snippets
 */
export function getPublicBaseUrl(request?: Request): string {
  // 1. Explicit public URL — Tailscale Funnel, Cloudflare Tunnel, or manually configured
  const publicUrl = process.env.HEYSUMMON_PUBLIC_URL;
  if (publicUrl) {
    return publicUrl.replace(/\/$/, "");
  }

  // 2. Behind a reverse proxy (x-forwarded-* headers)
  if (request) {
    const req = request as import("next/server").NextRequest;
    const proto = req.headers?.get("x-forwarded-proto") || "https";
    const host =
      req.headers?.get("x-forwarded-host") ||
      req.headers?.get("host");
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      return `${proto}://${host}`;
    }
  }

  // 3. Fallback
  return "http://localhost:3425";
}
