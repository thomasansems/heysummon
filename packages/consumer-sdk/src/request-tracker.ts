import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface TrackedRequest {
  requestId: string;
  refCode: string;
  provider?: string;
}

/**
 * File-based request tracker. Each request is stored as a file:
 *   {dir}/{requestId}          — contains the refCode
 *   {dir}/{requestId}.provider — contains the provider name (optional)
 *
 * Compatible with the existing OpenClaw .requests/ directory format.
 */
export class RequestTracker {
  constructor(private readonly dir: string) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  track(requestId: string, refCode: string, providerName?: string): void {
    writeFileSync(join(this.dir, requestId), refCode);
    if (providerName) {
      writeFileSync(join(this.dir, `${requestId}.provider`), providerName);
    }
  }

  getRefCode(requestId: string): string | null {
    const file = join(this.dir, requestId);
    if (!existsSync(file)) return null;
    return readFileSync(file, "utf8").trim();
  }

  getProvider(requestId: string): string | null {
    const file = join(this.dir, `${requestId}.provider`);
    if (!existsSync(file)) return null;
    return readFileSync(file, "utf8").trim();
  }

  remove(requestId: string): void {
    const refFile = join(this.dir, requestId);
    const provFile = join(this.dir, `${requestId}.provider`);
    if (existsSync(refFile)) unlinkSync(refFile);
    if (existsSync(provFile)) unlinkSync(provFile);
  }

  listActive(): TrackedRequest[] {
    if (!existsSync(this.dir)) return [];
    const files = readdirSync(this.dir);
    const result: TrackedRequest[] = [];

    for (const file of files) {
      // Skip .provider files, .watcher.pid, hidden files
      if (file.includes(".")) continue;

      const requestId = file;
      const refCode = this.getRefCode(requestId);
      if (!refCode) continue;

      result.push({
        requestId,
        refCode,
        provider: this.getProvider(requestId) ?? undefined,
      });
    }

    return result;
  }
}
