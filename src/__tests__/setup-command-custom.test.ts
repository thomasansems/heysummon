import { describe, it, expect } from "vitest";
import { buildInstallCommand, PLATFORM_META } from "@/lib/setup-command";
import { buildSetupCopyText } from "@/lib/setup-copy-text";

const baseOpts = {
  channel: "custom" as const,
  skillDir: "",
  baseUrl: "https://hs.example.com",
  apiKey: "hs_cli_abc123",
  timeout: 900,
  pollInterval: 3,
  globalInstall: false,
  expertName: "Thomas",
};

describe("PLATFORM_META.custom", () => {
  it("has the expected shape", () => {
    expect(PLATFORM_META.custom).toBeDefined();
    expect(PLATFORM_META.custom.label).toBe("Custom");
    expect(PLATFORM_META.custom.subtitle).toBe("API-only — any runtime");
  });
});

describe("buildInstallCommand('custom', …)", () => {
  it("returns a bash recipe that exports env vars and curls /api/v1/help", () => {
    const cmd = buildInstallCommand(baseOpts);
    expect(cmd).toContain('export HEYSUMMON_BASE_URL="https://hs.example.com"');
    expect(cmd).toContain('export HEYSUMMON_API_KEY="hs_cli_abc123"');
    expect(cmd).toContain("/api/v1/help");
    expect(cmd).toContain("curl -sS -X POST");
  });

  it("does not prefix the recipe with `cd ~/clawd`", () => {
    const cmd = buildInstallCommand(baseOpts);
    expect(cmd).not.toContain("cd ~/clawd");
  });

  it("points TypeScript/JavaScript runtimes at the consumer SDK", () => {
    const cmd = buildInstallCommand(baseOpts);
    expect(cmd).toContain("@heysummon/consumer-sdk");
  });

  it("includes the HEYSUMMON_SUMMON_CONTEXT export when summonContext is set", () => {
    const cmd = buildInstallCommand({
      ...baseOpts,
      summonContext: "Only ask when stuck.",
    });
    expect(cmd).toContain("HEYSUMMON_SUMMON_CONTEXT");
    expect(cmd).toContain("Only ask when stuck.");
  });

  it("omits HEYSUMMON_SUMMON_CONTEXT when none is provided", () => {
    const cmd = buildInstallCommand(baseOpts);
    expect(cmd).not.toContain("HEYSUMMON_SUMMON_CONTEXT");
  });

  it("shell-escapes a summonContext with single quotes", () => {
    const cmd = buildInstallCommand({
      ...baseOpts,
      summonContext: "Pablo's rules",
    });
    // shellEscape wraps in '...' and escapes internal quotes as '\''
    expect(cmd).toContain("Pablo'\\''s rules");
  });

  it("does not interpolate a hostile expertName into the bash payload", () => {
    const hostile = 'Thomas"; touch /tmp/pwn; echo "';
    const cmd = buildInstallCommand({ ...baseOpts, expertName: hostile });
    expect(cmd).not.toContain(hostile);
    expect(cmd).not.toContain("touch /tmp/pwn");
    expect(cmd).toContain("Ask your expert something");
  });
});

describe("buildSetupCopyText('custom', …)", () => {
  it("includes the env block, sample curl, and SDK pointer", () => {
    const txt = buildSetupCopyText("https://hs.example.com/setup/st_token", "", "custom");
    expect(txt).toContain("Custom — any runtime");
    expect(txt).toContain("/api/v1/setup/st_token/command");
    expect(txt).toContain("@heysummon/consumer-sdk");
  });

  it("renders the summoning guidelines block when provided", () => {
    const txt = buildSetupCopyText(
      "https://hs.example.com/setup/st_token",
      "Only ask when stuck.",
      "custom",
    );
    expect(txt).toContain("SUMMONING GUIDELINES");
    expect(txt).toContain("Only ask when stuck.");
  });
});
