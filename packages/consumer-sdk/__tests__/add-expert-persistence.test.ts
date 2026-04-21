import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Exercises skills/heysummon/scripts/add-expert.sh env-var persistence.
 * The platform one-liner sets HEYSUMMON_* vars as an env prefix; add-expert.sh
 * must persist them to $SKILL_DIR/.env so fresh shells see them.
 */
describe("add-expert.sh env persistence", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const realScript = join(repoRoot, "skills/heysummon/scripts/add-expert.sh");
  let tmp: string;
  let scriptsDir: string;
  let envFile: string;
  let expertsFile: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hey283-add-expert-"));
    scriptsDir = join(tmp, "scripts");
    mkdirSync(scriptsDir);
    copyFileSync(realScript, join(scriptsDir, "add-expert.sh"));
    // Stub sdk.sh so add-expert.sh doesn't actually call the real CLI.
    writeFileSync(join(scriptsDir, "sdk.sh"), 'SDK_CLI="true"\n');
    envFile = join(tmp, ".env");
    expertsFile = join(tmp, "experts.json");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function runAddExpert(env: Record<string, string>, args: string[] = ["hs_cli_test"]) {
    execFileSync("bash", [join(scriptsDir, "add-expert.sh"), ...args], {
      env: {
        ...process.env,
        HEYSUMMON_EXPERTS_FILE: expertsFile,
        ...env,
      },
      stdio: "pipe",
    });
  }

  function sourceEnv(file: string): Record<string, string> {
    const out = execFileSync(
      "bash",
      [
        "-c",
        `set -a; source "${file}"; set +a; node -e 'const k=["HEYSUMMON_BASE_URL","HEYSUMMON_API_KEY","HEYSUMMON_SUMMON_CONTEXT","HEYSUMMON_TIMEOUT","HEYSUMMON_POLL_INTERVAL","HEYSUMMON_TIMEOUT_FALLBACK","HEYSUMMON_EXPERTS_FILE"]; const o={}; for(const x of k){ if(process.env[x]!==undefined) o[x]=process.env[x]; } process.stdout.write(JSON.stringify(o));'`,
      ],
      { encoding: "utf8" }
    );
    return JSON.parse(out);
  }

  it("persists HEYSUMMON_BASE_URL and HEYSUMMON_SUMMON_CONTEXT from env prefix", () => {
    const multilineContext = [
      "## Summoning Guidelines",
      "",
      "- Stop on external comms",
      "- Prefer humans for design",
      "- single quote: ' and $dollar and `backtick`",
    ].join("\n");

    runAddExpert({
      HEYSUMMON_BASE_URL: "https://example.heysummon.online",
      HEYSUMMON_SUMMON_CONTEXT: multilineContext,
    });

    expect(existsSync(envFile)).toBe(true);
    const parsed = sourceEnv(envFile);
    expect(parsed.HEYSUMMON_BASE_URL).toBe("https://example.heysummon.online");
    expect(parsed.HEYSUMMON_SUMMON_CONTEXT).toBe(multilineContext);
  });

  it("persists HEYSUMMON_API_KEY only when provided via env prefix", () => {
    runAddExpert({
      HEYSUMMON_BASE_URL: "https://example.heysummon.online",
      HEYSUMMON_API_KEY: "hs_cli_prefix_key",
    });
    const parsed = sourceEnv(envFile);
    expect(parsed.HEYSUMMON_API_KEY).toBe("hs_cli_prefix_key");
  });

  it("does not write HEYSUMMON_API_KEY when only positional arg is given", () => {
    runAddExpert({
      HEYSUMMON_BASE_URL: "https://example.heysummon.online",
    });
    const parsed = sourceEnv(envFile);
    expect(parsed.HEYSUMMON_API_KEY).toBeUndefined();
    expect(parsed.HEYSUMMON_BASE_URL).toBe("https://example.heysummon.online");
  });

  it("is idempotent: re-running overwrites existing values, no duplicates", () => {
    runAddExpert({
      HEYSUMMON_BASE_URL: "https://first.example.online",
      HEYSUMMON_SUMMON_CONTEXT: "first",
    });
    runAddExpert({
      HEYSUMMON_BASE_URL: "https://second.example.online",
      HEYSUMMON_SUMMON_CONTEXT: "second",
    });

    const raw = readFileSync(envFile, "utf8");
    const baseUrlLines = raw.match(/^HEYSUMMON_BASE_URL=/gm) ?? [];
    const ctxLines = raw.match(/^HEYSUMMON_SUMMON_CONTEXT=/gm) ?? [];
    expect(baseUrlLines).toHaveLength(1);
    expect(ctxLines).toHaveLength(1);

    const parsed = sourceEnv(envFile);
    expect(parsed.HEYSUMMON_BASE_URL).toBe("https://second.example.online");
    expect(parsed.HEYSUMMON_SUMMON_CONTEXT).toBe("second");
  });

  it("preserves existing values when env prefix omits a key", () => {
    writeFileSync(envFile, "HEYSUMMON_BASE_URL='https://preexisting.online'\nHEYSUMMON_TIMEOUT='1200'\n");
    runAddExpert({
      HEYSUMMON_SUMMON_CONTEXT: "just the context",
    });
    const parsed = sourceEnv(envFile);
    expect(parsed.HEYSUMMON_BASE_URL).toBe("https://preexisting.online");
    expect(parsed.HEYSUMMON_TIMEOUT).toBe("1200");
    expect(parsed.HEYSUMMON_SUMMON_CONTEXT).toBe("just the context");
  });
});

/**
 * The platform-managed install puts the API key in experts.json, not .env.
 * ask.sh must accept that path instead of hard-failing on missing HEYSUMMON_API_KEY.
 */
describe("ask.sh API key resolution", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const scriptSource = join(repoRoot, "skills/heysummon/scripts/ask.sh");
  let tmp: string;
  let scriptsDir: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "hey283-ask-"));
    scriptsDir = join(tmp, "scripts");
    mkdirSync(scriptsDir);
    copyFileSync(scriptSource, join(scriptsDir, "ask.sh"));
    writeFileSync(join(scriptsDir, "sdk.sh"), 'SDK_CLI="true"\n');
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  function run(env: Record<string, string>) {
    const result = execFileSync(
      "bash",
      [join(scriptsDir, "ask.sh"), "irrelevant question"],
      {
        env: { ...process.env, ...env },
        encoding: "utf8",
        stdio: "pipe",
      }
    ).toString();
    return result;
  }

  it("exits with setup hint when neither .env API key nor experts.json are present", () => {
    expect(() =>
      run({
        HEYSUMMON_API_KEY: "",
        HEYSUMMON_EXPERTS_FILE: join(tmp, "missing.json"),
      })
    ).toThrow(/setup.sh|add-expert.sh/);
  });

  it("proceeds when experts.json exists, even with empty HEYSUMMON_API_KEY", () => {
    const expertsFile = join(tmp, "experts.json");
    writeFileSync(
      expertsFile,
      JSON.stringify({ experts: [{ name: "Expert", nameLower: "expert", apiKey: "hs_cli_x", expertId: "e", expertName: "Expert", addedAt: new Date().toISOString() }] })
    );
    // With SDK_CLI stubbed to `true`, ask.sh should reach the CLI step and exit 0.
    expect(() =>
      run({
        HEYSUMMON_API_KEY: "",
        HEYSUMMON_EXPERTS_FILE: expertsFile,
      })
    ).not.toThrow();
  });
});
