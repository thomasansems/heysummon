import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Provider } from "./types.js";

interface ProvidersFile {
  providers: Provider[];
}

/**
 * Typed replacement for the inline `node -e` JSON manipulation in the bash scripts.
 * Reads/writes providers.json with deduplication by API key and case-insensitive name.
 */
export class ProviderStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): Provider[] {
    if (!existsSync(this.filePath)) return [];
    try {
      const data = JSON.parse(readFileSync(this.filePath, "utf8")) as ProvidersFile;
      return Array.isArray(data.providers) ? data.providers : [];
    } catch {
      return [];
    }
  }

  save(providers: Provider[]): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify({ providers }, null, 2));
  }

  /**
   * Add or update a provider entry.
   * Deduplicates by API key and case-insensitive name (same logic as the bash script).
   */
  add(entry: Omit<Provider, "addedAt" | "nameLower"> & { addedAt?: string }): Provider {
    const providers = this.load();
    const nameLower = entry.name.toLowerCase();

    // Remove existing entries with same key or name (case-insensitive)
    const filtered = providers.filter(
      (p) => p.apiKey !== entry.apiKey && p.nameLower !== nameLower
    );

    const newEntry: Provider = {
      name: entry.name,
      nameLower,
      apiKey: entry.apiKey,
      providerId: entry.providerId,
      providerName: entry.providerName,
      addedAt: entry.addedAt ?? new Date().toISOString(),
    };

    filtered.push(newEntry);
    this.save(filtered);
    return newEntry;
  }

  /** Case-insensitive lookup by name or alias */
  findByName(name: string): Provider | undefined {
    const lower = name.toLowerCase();
    return this.load().find((p) => p.nameLower === lower || p.name.toLowerCase() === lower);
  }

  /** Look up by exact API key */
  findByKey(apiKey: string): Provider | undefined {
    return this.load().find((p) => p.apiKey === apiKey);
  }

  /** Returns the first provider (default when only one is registered) */
  getDefault(): Provider | undefined {
    return this.load()[0];
  }

  remove(apiKey: string): boolean {
    const providers = this.load();
    const filtered = providers.filter((p) => p.apiKey !== apiKey);
    if (filtered.length === providers.length) return false;
    this.save(filtered);
    return true;
  }
}
