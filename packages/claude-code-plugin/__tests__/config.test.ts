import { describe, it, expect } from "vitest";
import { loadConfig } from "../src/config.js";
import { SummonConfigError } from "../src/errors.js";

describe("loadConfig", () => {
  it("returns a populated config when both required env vars are set", () => {
    const config = loadConfig({
      env: {
        HEYSUMMON_API_KEY: "hs_cli_test",
        HEYSUMMON_URL: "http://localhost:3425",
      },
    });

    expect(config.apiKey).toBe("hs_cli_test");
    expect(config.baseUrl).toBe("http://localhost:3425");
    expect(config.timeoutMs).toBe(15 * 60 * 1000);
  });

  it("raises SummonConfigError when HEYSUMMON_API_KEY is missing", () => {
    expect(() =>
      loadConfig({ env: { HEYSUMMON_URL: "http://localhost:3425" } })
    ).toThrowError(SummonConfigError);
  });

  it("raises SummonConfigError when HEYSUMMON_URL is missing", () => {
    expect(() =>
      loadConfig({ env: { HEYSUMMON_API_KEY: "hs_cli_test" } })
    ).toThrowError(SummonConfigError);
  });

  it("aggregates missing keys on SummonConfigError.missingKeys", () => {
    try {
      loadConfig({ env: {} });
      throw new Error("expected config error");
    } catch (err) {
      expect(err).toBeInstanceOf(SummonConfigError);
      const cfg = err as SummonConfigError;
      expect(cfg.missingKeys).toEqual(["HEYSUMMON_API_KEY", "HEYSUMMON_URL"]);
    }
  });

  it("parses HEYSUMMON_TIMEOUT seconds into milliseconds", () => {
    const config = loadConfig({
      env: {
        HEYSUMMON_API_KEY: "hs_cli_test",
        HEYSUMMON_URL: "http://localhost:3425",
        HEYSUMMON_TIMEOUT: "120",
      },
    });

    expect(config.timeoutMs).toBe(120 * 1000);
  });

  it("rejects a non-numeric HEYSUMMON_TIMEOUT", () => {
    expect(() =>
      loadConfig({
        env: {
          HEYSUMMON_API_KEY: "hs_cli_test",
          HEYSUMMON_URL: "http://localhost:3425",
          HEYSUMMON_TIMEOUT: "soon",
        },
      })
    ).toThrowError(SummonConfigError);
  });

  it("honors an explicit timeoutMs override even when env sets HEYSUMMON_TIMEOUT", () => {
    const config = loadConfig({
      env: {
        HEYSUMMON_API_KEY: "hs_cli_test",
        HEYSUMMON_URL: "http://localhost:3425",
        HEYSUMMON_TIMEOUT: "60",
      },
      timeoutMs: 7,
    });

    expect(config.timeoutMs).toBe(7);
  });
});
