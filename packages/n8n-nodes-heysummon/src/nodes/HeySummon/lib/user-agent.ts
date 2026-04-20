import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const FALLBACK_USER_AGENT = "n8n-nodes-heysummon/unknown (n8n; node)";

let cached: string | null = null;

function findPackageJson(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    try {
      const candidate = join(dir, "package.json");
      const raw = readFileSync(candidate, "utf8");
      const parsed = JSON.parse(raw) as { name?: string };
      if (parsed.name === "n8n-nodes-heysummon") {
        return candidate;
      }
    } catch {
      // try parent
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Build the User-Agent string for outbound HeySummon API calls from this node.
 * Version is read from the node package's own package.json at runtime per PRD §4.8.
 * Falls back to "n8n-nodes-heysummon/unknown" if the package.json cannot be located,
 * so a misconfigured install never crashes outbound requests.
 */
export function getUserAgent(): string {
  if (cached) return cached;
  const pkgPath = findPackageJson(__dirname);
  if (!pkgPath) {
    cached = FALLBACK_USER_AGENT;
    return cached;
  }
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    const version = pkg.version?.trim() || "unknown";
    cached = `n8n-nodes-heysummon/${version} (n8n; node)`;
  } catch {
    cached = FALLBACK_USER_AGENT;
  }
  return cached;
}

/** Test helper: drop the cached value so tests can re-resolve. */
export function _resetUserAgentCache(): void {
  cached = null;
}
