import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildInstallCommand, PLATFORM_META, type ClientChannel } from "@/lib/setup-command";

const baseOpts = {
  skillDir: ".claude/skills/heysummon",
  baseUrl: "https://hs.example.com",
  apiKey: "hs_cli_abc123",
  timeout: 900,
  pollInterval: 3,
  timeoutFallback: "proceed_cautiously",
  globalInstall: false,
  expertName: "Thomas",
};

const openclawOpts = { ...baseOpts, channel: "openclaw" as const, skillDir: "skills/heysummon" };
const claudecodeOpts = { ...baseOpts, channel: "claudecode" as const };

/**
 * The install command always begins with the idempotency guard, then a blank
 * line plus `npm install ...`. Slice the guard off so we can exec it in
 * isolation without triggering npm/curl side effects.
 */
function extractGuardPreamble(cmd: string): string {
  const marker = "\nnpm install";
  const idx = cmd.indexOf(marker);
  if (idx === -1) throw new Error("could not locate npm install boundary in command");
  return cmd.slice(0, idx);
}

/**
 * Pull the base64-encoded .env body out of the install command.
 * The encoded body is emitted as: printf '%s' '<base64>' | base64 -d > <dir>/.env
 */
function extractEnvBase64(cmd: string): string {
  const match = cmd.match(/printf '%s' '([A-Za-z0-9+/=]+)' \| base64 -d > [^\n]+\/\.env/);
  if (!match) throw new Error("could not find base64-encoded .env writer in command");
  return match[1];
}

function decodeEnvBody(cmd: string): string {
  return Buffer.from(extractEnvBase64(cmd), "base64").toString("utf-8");
}

/** Source the decoded .env in bash and read back a single variable. */
function sourceAndRead(envBody: string, variable: string): string {
  const dir = mkdtempSync(join(tmpdir(), "hey438-env-"));
  const envPath = join(dir, ".env");
  writeFileSync(envPath, envBody);
  const out = execFileSync(
    "bash",
    ["-c", `set -a; . "${envPath}"; printf '%s' "$${variable}"`],
    { encoding: "utf-8" },
  );
  return out;
}

describe("buildInstallCommand — OpenClaw (A1, A2)", () => {
  it("T1: never contains 'cd ~/clawd' or any other 'cd ~' prefix", () => {
    const cmd = buildInstallCommand(openclawOpts);
    expect(cmd).not.toContain("cd ~/clawd");
    expect(cmd).not.toMatch(/(^|\s)cd\s+~/);
  });

  it("T2: contains the script-download loop and the add-expert.sh invocation", () => {
    const cmd = buildInstallCommand(openclawOpts);
    expect(cmd).toContain("mkdir -p skills/heysummon/scripts");
    expect(cmd).toContain("for f in ask.sh sdk.sh setup.sh add-expert.sh list-experts.sh check-status.sh");
    expect(cmd).toContain("/api/v1/skill-scripts/openclaw?file=$f");
    expect(cmd).toContain("bash skills/heysummon/scripts/add-expert.sh");
  });

  it("T-A6: every skill channel registers the expert via add-expert.sh between .env write and verify", () => {
    const channels: ClientChannel[] = ["openclaw", "claudecode", "codex", "gemini", "cursor"];
    for (const channel of channels) {
      const skillDir = PLATFORM_META[channel].skillDir;
      const cmd = buildInstallCommand({
        ...baseOpts,
        channel,
        skillDir,
      });

      const envWriteIdx = cmd.indexOf(`> ${skillDir}/.env`);
      const registerIdx = cmd.indexOf(`bash ${skillDir}/scripts/add-expert.sh`);
      const verifyIdx = cmd.indexOf("Verifying connection");

      expect(envWriteIdx, `${channel}: .env writer present`).toBeGreaterThan(-1);
      expect(registerIdx, `${channel}: add-expert.sh invocation present`).toBeGreaterThan(-1);
      expect(verifyIdx, `${channel}: verify step present`).toBeGreaterThan(-1);

      // Ordering: .env write -> register expert -> verify.
      expect(registerIdx, `${channel}: add-expert.sh runs after .env write`).toBeGreaterThan(envWriteIdx);
      expect(verifyIdx, `${channel}: verify runs after add-expert.sh`).toBeGreaterThan(registerIdx);

      // The invocation should pass the safe-quoted apiKey and expertName.
      expect(cmd).toContain(
        `bash ${skillDir}/scripts/add-expert.sh '${baseOpts.apiKey}' '${baseOpts.expertName}'`,
      );
    }
  });

  it("T3: shares the script-download loop verbatim with claudecode (parity)", () => {
    const oc = buildInstallCommand(openclawOpts);
    const cc = buildInstallCommand(claudecodeOpts);
    // Both should download from the platform-scoped route.
    expect(oc).toMatch(/\/api\/v1\/skill-scripts\/openclaw\?file=\$f/);
    expect(cc).toMatch(/\/api\/v1\/skill-scripts\/claudecode\?file=\$f/);
    // The loop body (between `for f in` and `done`) is identical except for
    // the platform segment and skill dir — extract and compare structure.
    const ocLoop = oc.match(/for f in[\s\S]*?done/)?.[0];
    const ccLoop = cc.match(/for f in[\s\S]*?done/)?.[0];
    expect(ocLoop).toBeDefined();
    expect(ccLoop).toBeDefined();
    expect(ocLoop!.replace(/openclaw|skills\/heysummon/g, "X"))
      .toBe(ccLoop!.replace(/claudecode|\.claude\/skills\/heysummon/g, "X"));
  });
});

describe("buildInstallCommand — heredoc safety (A3)", () => {
  it("T4: a hostile 5-line summonContext round-trips through .env", () => {
    const hostile = [
      `Line one with "double quotes"`,
      "Line two with `backticks` and $variables",
      "Line three with backslashes \\ and \\n literal",
      "Line four with single quote: 'escape me'",
      "Line five with mixed: $(rm -rf /) `boom` \"end\"",
    ].join("\n");

    const cmd = buildInstallCommand({ ...claudecodeOpts, summonContext: hostile });
    const envBody = decodeEnvBody(cmd);

    // Sanity: the .env body itself doesn't expose the raw payload to a shell
    // parser — values are single-quoted.
    expect(envBody).toMatch(/^HEYSUMMON_SUMMON_CONTEXT='/m);

    // Bash sources the .env and gives us back the original string byte-for-byte.
    const roundTripped = sourceAndRead(envBody, "HEYSUMMON_SUMMON_CONTEXT");
    expect(roundTripped).toBe(hostile);
  });

  it("T5: a summonContext containing 'EOF' and HEREDOC-like tokens does not break the build", () => {
    const tricky = "ends with EOF\nEOF\n<<'EOF'\nHEYSUMMON_API_KEY=evil";
    const cmd = buildInstallCommand({ ...claudecodeOpts, summonContext: tricky });
    const roundTripped = sourceAndRead(decodeEnvBody(cmd), "HEYSUMMON_SUMMON_CONTEXT");
    expect(roundTripped).toBe(tricky);
    // The decoded body must still parse to the *intended* api key, not the injected one.
    const apiKey = sourceAndRead(decodeEnvBody(cmd), "HEYSUMMON_API_KEY");
    expect(apiKey).toBe(claudecodeOpts.apiKey);
  });

  it("omits HEYSUMMON_SUMMON_CONTEXT from the .env when not provided", () => {
    const cmd = buildInstallCommand(claudecodeOpts);
    const envBody = decodeEnvBody(cmd);
    expect(envBody).not.toContain("HEYSUMMON_SUMMON_CONTEXT");
  });

  it("preserves api key, timeout, poll interval, and fallback in the .env", () => {
    const cmd = buildInstallCommand(claudecodeOpts);
    const envBody = decodeEnvBody(cmd);
    expect(sourceAndRead(envBody, "HEYSUMMON_API_KEY")).toBe(claudecodeOpts.apiKey);
    expect(sourceAndRead(envBody, "HEYSUMMON_TIMEOUT")).toBe(String(claudecodeOpts.timeout));
    expect(sourceAndRead(envBody, "HEYSUMMON_POLL_INTERVAL")).toBe(String(claudecodeOpts.pollInterval));
    expect(sourceAndRead(envBody, "HEYSUMMON_TIMEOUT_FALLBACK")).toBe(claudecodeOpts.timeoutFallback);
    expect(sourceAndRead(envBody, "HEYSUMMON_BASE_URL")).toBe(claudecodeOpts.baseUrl);
  });
});

describe("buildInstallCommand — idempotency guard (A4)", () => {
  function runGuardWith(envBody: string | null, apiKey: string, force = false) {
    const dir = mkdtempSync(join(tmpdir(), "hey438-guard-"));
    const skillDir = join(dir, "skill");
    spawnSync("mkdir", ["-p", skillDir]);
    if (envBody !== null) {
      writeFileSync(join(skillDir, ".env"), envBody);
    }

    const cmd = buildInstallCommand({
      ...claudecodeOpts,
      apiKey,
      skillDir,
    });
    const guard = extractGuardPreamble(cmd);

    return spawnSync("bash", ["-c", guard], {
      encoding: "utf-8",
      env: { ...process.env, HEYSUMMON_FORCE: force ? "1" : "" },
    });
  }

  function envBodyFor(apiKey: string): string {
    // Reuse the production formatter so the guard reads exactly the same shape
    // it would in the wild.
    const cmd = buildInstallCommand({ ...claudecodeOpts, apiKey });
    return decodeEnvBody(cmd);
  }

  it("T6: same apiKey -> exits 0 with 'already configured' message", () => {
    const result = runGuardWith(envBodyFor("hs_cli_match"), "hs_cli_match");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("already configured");
    expect(result.stdout).toContain("nothing to do");
  });

  it("T7: different apiKey, no HEYSUMMON_FORCE -> exits 1 with remediation message", () => {
    const result = runGuardWith(envBodyFor("hs_cli_old"), "hs_cli_new");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing to overwrite");
    expect(result.stderr).toContain("HEYSUMMON_FORCE=1");
  });

  it("T8: different apiKey + HEYSUMMON_FORCE=1 -> exits 0 (proceeds, guard does not block)", () => {
    const result = runGuardWith(envBodyFor("hs_cli_old"), "hs_cli_new", true);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("missing .env -> guard is a no-op (exits 0, no output)", () => {
    const result = runGuardWith(null, "hs_cli_new");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  it("malformed .env -> treated as different-key (refuses without force)", () => {
    const result = runGuardWith("this is not valid dotenv\n@@@\n", "hs_cli_real");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Refusing to overwrite");
  });
});

describe("buildInstallCommand — safety regression (T9)", () => {
  it("does not interpolate a hostile expertName into the OpenClaw payload", () => {
    // The hostile name embeds a single quote so the escape transformation is
    // visibly different from the input — proves we did not pass it raw.
    const hostile = "Thomas'; rm -rf / #";
    const cmd = buildInstallCommand({ ...openclawOpts, expertName: hostile });
    expect(cmd).not.toContain(hostile);
    // The shellEscape form '...'\''...' must be present.
    expect(cmd).toContain("'Thomas'\\''; rm -rf / #'");
  });

  it("exists check: skill scripts that the OpenClaw install relies on are present in the repo", () => {
    // If anyone deletes these from the repo, the OpenClaw install breaks even
    // though the platform route is happy.
    for (const f of ["ask.sh", "sdk.sh", "setup.sh", "add-expert.sh", "list-experts.sh", "check-status.sh"]) {
      expect(existsSync(join(process.cwd(), "skills", "heysummon", "scripts", f))).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "skills", "openclaw", "heysummon", "SKILL.md"))).toBe(true);
  });
});

describe("buildInstallCommand — snapshot all skill channels", () => {
  const channels: ClientChannel[] = ["openclaw", "claudecode", "codex", "gemini", "cursor"];
  for (const channel of channels) {
    it(`snapshot: ${channel}`, () => {
      const cmd = buildInstallCommand({
        ...baseOpts,
        channel,
        skillDir: PLATFORM_META[channel].skillDir,
        summonContext: "Only ask when truly stuck.",
      });
      expect(cmd).toMatchSnapshot();
    });
  }
});
