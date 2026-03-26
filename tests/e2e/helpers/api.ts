import { BASE_URL, GUARD_URL } from "./constants";

type Headers = Record<string, string>;

/** Typed GET request against the local dev server */
export async function apiGet<T>(path: string, headers?: Headers): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`GET ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Typed POST request against the local dev server.
 *  When GUARD_URL differs from BASE_URL (CI has REQUIRE_GUARD=true),
 *  all /api/v1/* requests are routed through the Guard proxy.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  headers?: Headers
): Promise<T> {
  const useGuard = GUARD_URL && GUARD_URL !== BASE_URL && path.startsWith("/api/v1/");
  const url = useGuard ? `${GUARD_URL}${path}` : `${BASE_URL}${path}`;
  
  // Debug logging for /api/v1/help submissions
  if (path === "/api/v1/help") {
    console.log(`[apiPost] ${path} → ${useGuard ? "Guard" : "Direct"} (${url})`);
  }
  
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`POST ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Typed PATCH request against the local dev server */
export async function apiPatch<T>(
  path: string,
  body: unknown,
  headers?: Headers
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`PATCH ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Returns raw Response without throwing (for testing error responses) */
export async function apiRaw(
  method: string,
  path: string,
  body?: unknown,
  headers?: Headers
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json", ...headers } : headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}
