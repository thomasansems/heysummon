import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let cached: string | null = null;

function findPackageJson(start: string): string {
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
  throw new Error("n8n-nodes-heysummon package.json not found from " + start);
}

/**
 * Build the User-Agent string for outbound HeySummon API calls from this node.
 * Version is read from the node package's own package.json at runtime per PRD §4.8.
 */
export function getUserAgent(): string {
  if (cached) return cached;
  const pkgPath = findPackageJson(__dirname);
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  cached = `n8n-nodes-heysummon/${pkg.version} (n8n; node)`;
  return cached;
}

/** Test helper: drop the cached value so tests can re-resolve. */
export function _resetUserAgentCache(): void {
  cached = null;
}
