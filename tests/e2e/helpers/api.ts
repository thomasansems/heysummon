import { BASE_URL } from "./constants";

type Headers = Record<string, string>;

/**
 * Assert the HTTP status matches what the test expects.
 * Produces a clear failure message: "GET /api/v1/help -> expected 200, got 403: {...}"
 */
async function assertStatus(
  method: string,
  path: string,
  res: Response,
  expectedStatus: number
): Promise<void> {
  if (res.status !== expectedStatus) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(
      `${method} ${path} → expected HTTP ${expectedStatus}, got ${res.status}: ${text}`
    );
  }
}

/** Typed GET request — asserts expectedStatus (default 200) */
export async function apiGet<T>(
  path: string,
  headers?: Headers,
  expectedStatus = 200
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  await assertStatus("GET", path, res, expectedStatus);
  return res.json() as Promise<T>;
}

/** Typed POST request — asserts expectedStatus (default 200) */
export async function apiPost<T>(
  path: string,
  body: unknown,
  headers?: Headers,
  expectedStatus = 200
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  await assertStatus("POST", path, res, expectedStatus);
  return res.json() as Promise<T>;
}

/** Typed PATCH request — asserts expectedStatus (default 200) */
export async function apiPatch<T>(
  path: string,
  body: unknown,
  headers?: Headers,
  expectedStatus = 200
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  await assertStatus("PATCH", path, res, expectedStatus);
  return res.json() as Promise<T>;
}

/** Returns raw Response without throwing — use when testing error/edge cases */
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
