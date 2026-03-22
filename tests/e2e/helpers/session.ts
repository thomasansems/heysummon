import { BASE_URL, PW } from "./constants";

/**
 * Authenticates as the Playwright test user via credentials login.
 * Returns the Set-Cookie header value to use in subsequent authenticated requests.
 *
 * Usage:
 *   const cookie = await getAuthCookie();
 *   const data = await apiGet("/api/v1/setup/verify", { Cookie: cookie });
 */
export async function getAuthCookie(
  email = PW.EMAIL,
  password = PW.PASSWORD
): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });

  // NextAuth credentials callback returns a redirect with Set-Cookie on success
  const cookie = res.headers.get("set-cookie");
  if (!cookie) {
    // Fallback: try the sign-in endpoint used by the form
    const signIn = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ email, password, callbackUrl: "/" }),
      redirect: "manual",
    });
    const fallbackCookie = signIn.headers.get("set-cookie");
    if (!fallbackCookie) {
      throw new Error(
        `Could not authenticate as ${email}. Status: ${res.status} / ${signIn.status}. ` +
          `Make sure the dev server is running and the seed has been applied.`
      );
    }
    return fallbackCookie;
  }
  return cookie;
}

/**
 * Returns fetch-compatible headers with a session cookie.
 * Useful for calling dashboard-authenticated endpoints in tests.
 */
export async function authHeaders(
  email = PW.EMAIL,
  password = PW.PASSWORD
): Promise<Record<string, string>> {
  const cookie = await getAuthCookie(email, password);
  return { Cookie: cookie };
}
