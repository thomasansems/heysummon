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
 *  Help submissions (/api/v1/help) are routed through the Guard proxy
 *  when GUARD_URL is set (CI has REQUIRE_GUARD=true).
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  headers?: Headers
): Promise<T> {
  const url = path === "/api/v1/help" ? `${GUARD_URL}${path}` : `${BASE_URL}${path}`;
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
