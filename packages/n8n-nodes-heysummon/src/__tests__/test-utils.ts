import { vi } from "vitest";

export interface RouteHandler {
  (init: { method: string; headers: Headers; body?: unknown }): Promise<{
    status: number;
    body: unknown;
  }> | { status: number; body: unknown };
}

export interface CapturedCall {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
}

export interface MockFetchHandle {
  calls: CapturedCall[];
  restore(): void;
}

/**
 * Install a global fetch mock that routes URL+method matches to handlers.
 * Returns a handle holding all captured calls and a restore() helper.
 */
export function installFetchMock(
  routes: Array<{
    method?: string;
    matcher: string | RegExp;
    handler: RouteHandler;
  }>
): MockFetchHandle {
  const original = globalThis.fetch;
  const calls: CapturedCall[] = [];

  const fakeFetch = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === "string" ? input : (input as { url: string }).url;
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = new Headers(init?.headers as HeadersInit | undefined);
    const bodyText = init?.body ? init.body.toString() : undefined;
    let parsedBody: unknown = undefined;
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        parsedBody = bodyText;
      }
    }
    calls.push({ url, method, headers, body: parsedBody });

    const route = routes.find((r) => {
      const methodOk = !r.method || r.method.toUpperCase() === method;
      const urlOk =
        typeof r.matcher === "string" ? url.endsWith(r.matcher) : r.matcher.test(url);
      return methodOk && urlOk;
    });

    if (!route) {
      throw new Error(`No mock route for ${method} ${url}`);
    }

    const result = await route.handler({ method, headers, body: parsedBody });
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    });
  });

  // @ts-expect-error overriding global for test
  globalThis.fetch = fakeFetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

export function networkError(message = "ECONNREFUSED"): RouteHandler {
  return () => {
    throw new TypeError(message);
  };
}
