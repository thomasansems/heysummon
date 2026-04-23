import { SummonConfigError } from "./errors.js";

export interface SummonConfig {
  apiKey: string;
  baseUrl: string;
  /** Maximum time in milliseconds to wait for a terminal status. */
  timeoutMs: number;
}

export interface LoadConfigOptions {
  /** Override the process env lookup (useful for tests). */
  env?: NodeJS.ProcessEnv;
  /** Override the default timeout (ms). */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000; // 900s

/**
 * Load the summon runtime config from environment variables.
 *
 * Required:
 *   HEYSUMMON_API_KEY - consumer API key (hs_cli_... or similar)
 *   HEYSUMMON_URL     - platform base URL (e.g. http://localhost:3425)
 *
 * Optional:
 *   HEYSUMMON_TIMEOUT - poll timeout in seconds (default: 900)
 */
export function loadConfig(opts: LoadConfigOptions = {}): SummonConfig {
  const env = opts.env ?? process.env;
  const apiKey = env.HEYSUMMON_API_KEY?.trim();
  const baseUrl = env.HEYSUMMON_URL?.trim();

  const missing: string[] = [];
  if (!apiKey) missing.push("HEYSUMMON_API_KEY");
  if (!baseUrl) missing.push("HEYSUMMON_URL");
  if (missing.length > 0) {
    throw new SummonConfigError(
      `Missing required environment variable(s): ${missing.join(", ")}`,
      missing
    );
  }

  let timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const rawTimeout = env.HEYSUMMON_TIMEOUT?.trim();
  if (opts.timeoutMs === undefined && rawTimeout !== undefined && rawTimeout !== "") {
    const seconds = Number(rawTimeout);
    if (!Number.isFinite(seconds) || seconds <= 0) {
      throw new SummonConfigError(
        `HEYSUMMON_TIMEOUT must be a positive number of seconds, got "${rawTimeout}"`,
        ["HEYSUMMON_TIMEOUT"]
      );
    }
    timeoutMs = Math.floor(seconds * 1000);
  }

  return {
    apiKey: apiKey as string,
    baseUrl: baseUrl as string,
    timeoutMs,
  };
}
