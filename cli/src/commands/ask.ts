import * as fs from "fs";
import { spawn } from "child_process";
import { getEnvFile } from "../lib/config";

// Exit codes:
//   0 approved / expert replied
//   1 denied
//   2 timeout
//   3 config / auth error (missing creds, invalid key, bad flag)
//   4 network / server error

export interface AskOptions {
  question: string;
  timeoutSeconds: number;
  channel?: string;
  quiet: boolean;
}

export function parseDuration(input: string): number {
  const m = /^(\d+)\s*(s|sec|secs|seconds|m|min|mins|minutes|h|hr|hrs|hours)?$/i.exec(
    input.trim()
  );
  if (!m) {
    throw new Error(`invalid --timeout '${input}' (examples: 30s, 5m, 1h)`);
  }
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  if (unit.startsWith("h")) return n * 3600;
  if (unit.startsWith("m") && !unit.startsWith("ms")) return n * 60;
  return n;
}

function parseEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(path)) return result;
  let content = "";
  try {
    content = fs.readFileSync(path, "utf-8");
  } catch {
    return result;
  }
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

export function resolveCredentials(): { baseUrl: string; apiKey: string } | null {
  let apiKey = process.env.HEYSUMMON_API_KEY || "";
  let baseUrl = process.env.HEYSUMMON_BASE_URL || "";

  if (!apiKey || !baseUrl) {
    const fileEnv = parseEnvFile(getEnvFile());
    if (!apiKey && fileEnv.HEYSUMMON_API_KEY) apiKey = fileEnv.HEYSUMMON_API_KEY;
    if (!baseUrl && fileEnv.HEYSUMMON_BASE_URL) baseUrl = fileEnv.HEYSUMMON_BASE_URL;
  }

  if (!apiKey || !baseUrl) return null;
  return { apiKey, baseUrl };
}

export function printMissingCredentials(): void {
  process.stderr.write(
    "heysummon: missing HEYSUMMON_API_KEY or HEYSUMMON_BASE_URL.\n" +
      "Set them in your shell, or add to ~/.heysummon/.env:\n" +
      "  HEYSUMMON_API_KEY=hsk_...\n" +
      "  HEYSUMMON_BASE_URL=https://your-instance.example\n" +
      "Create a key at <base-url>/dashboard/keys\n"
  );
}

export function parseAskArgs(argv: string[]): AskOptions | { error: string } {
  // argv is everything after 'ask' (or after the positional-sugar question).
  // First non-flag token is the question if not supplied already.
  let question: string | undefined;
  let timeoutStr = "5m";
  let channel: string | undefined;
  let quiet = false;
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--timeout") {
      timeoutStr = argv[++i] ?? "";
    } else if (arg === "--channel") {
      channel = argv[++i];
    } else if (arg === "-q" || arg === "--quiet") {
      quiet = true;
    } else if (arg === "--require") {
      // Reserved: only 'approve' is recognised and is the default behaviour.
      const mode = argv[++i];
      if (mode && mode !== "approve") {
        return { error: `unknown --require mode '${mode}' (expected 'approve')` };
      }
    } else if (arg.startsWith("-")) {
      return { error: `unknown flag '${arg}'` };
    } else if (question === undefined) {
      question = arg;
    } else {
      return { error: `unexpected positional argument '${arg}'` };
    }
    i++;
  }

  if (question === undefined || question.trim() === "") {
    return { error: "empty question" };
  }

  let timeoutSeconds: number;
  try {
    timeoutSeconds = parseDuration(timeoutStr);
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  return { question, timeoutSeconds, channel, quiet };
}

function resolveSdkCli(): string | null {
  try {
    return require.resolve("@heysummon/consumer-sdk/dist/cli.js");
  } catch {
    return null;
  }
}

export async function ask(argv: string[]): Promise<number> {
  const parsed = parseAskArgs(argv);
  if ("error" in parsed) {
    process.stderr.write(`heysummon: ${parsed.error}\n`);
    process.stderr.write(
      'Usage: heysummon "<question>" [--timeout 5m] [--channel <name>] [-q] [--require approve]\n'
    );
    return 3;
  }

  const creds = resolveCredentials();
  if (!creds) {
    printMissingCredentials();
    return 3;
  }

  const sdkCli = resolveSdkCli();
  if (!sdkCli) {
    process.stderr.write(
      "heysummon: consumer SDK not found. The installed package appears incomplete; reinstall with `npm i -g @heysummon/app`.\n"
    );
    return 3;
  }

  const spawnArgs: string[] = [
    sdkCli,
    "submit-and-poll",
    "--question",
    parsed.question,
    "--ask-mode",
    "--requires-approval",
  ];
  if (parsed.channel) {
    spawnArgs.push("--expert", parsed.channel);
  }
  if (parsed.quiet) {
    spawnArgs.push("--quiet");
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HEYSUMMON_API_KEY: creds.apiKey,
    HEYSUMMON_BASE_URL: creds.baseUrl,
    HEYSUMMON_TIMEOUT: String(parsed.timeoutSeconds),
  };

  return new Promise<number>((resolve) => {
    const child = spawn(process.execPath, spawnArgs, {
      env,
      stdio: ["inherit", "inherit", "inherit"],
    });
    child.on("close", (code) => resolve(code ?? 4));
    child.on("error", (err) => {
      if (!parsed.quiet) {
        process.stderr.write(
          `heysummon: failed to start consumer SDK: ${err.message}\n`
        );
      }
      resolve(4);
    });
  });
}
