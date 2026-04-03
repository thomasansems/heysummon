import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Expert } from "./types.js";

interface ExpertsFile {
  experts: Expert[];
}

/**
 * Typed replacement for the inline `node -e` JSON manipulation in the bash scripts.
 * Reads/writes experts.json with deduplication by API key and case-insensitive name.
 */
export class ExpertStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  load(): Expert[] {
    if (!existsSync(this.filePath)) return [];
    try {
      const data = JSON.parse(readFileSync(this.filePath, "utf8")) as ExpertsFile;
      return Array.isArray(data.experts) ? data.experts : [];
    } catch {
      return [];
    }
  }

  save(experts: Expert[]): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify({ experts }, null, 2));
  }

  /**
   * Add or update an expert entry.
   * Deduplicates by API key and case-insensitive name (same logic as the bash script).
   */
  add(entry: Omit<Expert, "addedAt" | "nameLower"> & { addedAt?: string }): Expert {
    const experts = this.load();
    const nameLower = entry.name.toLowerCase();

    // Remove existing entries with same key or name (case-insensitive)
    const filtered = experts.filter(
      (p) => p.apiKey !== entry.apiKey && p.nameLower !== nameLower
    );

    const newEntry: Expert = {
      name: entry.name,
      nameLower,
      apiKey: entry.apiKey,
      expertId: entry.expertId,
      expertName: entry.expertName,
      addedAt: entry.addedAt ?? new Date().toISOString(),
    };

    filtered.push(newEntry);
    this.save(filtered);
    return newEntry;
  }

  /** Case-insensitive lookup by name or alias */
  findByName(name: string): Expert | undefined {
    const lower = name.toLowerCase();
    return this.load().find((p) => p.nameLower === lower || p.name.toLowerCase() === lower);
  }

  /** Look up by exact API key */
  findByKey(apiKey: string): Expert | undefined {
    return this.load().find((p) => p.apiKey === apiKey);
  }

  /** Returns the first expert (default when only one is registered) */
  getDefault(): Expert | undefined {
    return this.load()[0];
  }

  remove(apiKey: string): boolean {
    const experts = this.load();
    const filtered = experts.filter((p) => p.apiKey !== apiKey);
    if (filtered.length === experts.length) return false;
    this.save(filtered);
    return true;
  }
}
