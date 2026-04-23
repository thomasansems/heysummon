#!/usr/bin/env node
/**
 * HeySummon Consumer SDK CLI
 *
 * Shared CLI entry point used by both Claude Code and OpenClaw skill scripts.
 * Subcommands: submit-and-poll, add-expert, list-experts,
 *              check-status, keygen
 *
 * All config comes from environment variables (set by the calling bash wrapper):
 *   HEYSUMMON_BASE_URL, HEYSUMMON_API_KEY, HEYSUMMON_EXPERTS_FILE,
 *   HEYSUMMON_TIMEOUT,
 *   HEYSUMMON_POLL_INTERVAL
 */

import { HeySummonClient, HeySummonHttpError } from "./client.js";
import { ExpertStore } from "./expert-store.js";
import { generateEphemeralKeys, generatePersistentKeys } from "./crypto.js";
import type { DecryptedMessage } from "./types.js";
import { existsSync } from "node:fs";

// ---------------------------------------------------------------------------
// Arg parsing helpers
// ---------------------------------------------------------------------------

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    process.stderr.write(`Missing required env var: ${name}\n`);
    process.exit(1);
  }
  return val;
}

function optEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

async function cmdSubmitAndPoll(args: string[]): Promise<void> {
  const question = getArg(args, "--question");
  if (!question) {
    process.stderr.write("Usage: cli submit-and-poll --question <q> [--expert <name>] [--context <json>] [--requires-approval] [--ask-mode] [--quiet]\n");
    process.exit(1);
  }

  const expertArg = getArg(args, "--expert");
  const contextArg = getArg(args, "--context");
  const requiresApproval = hasFlag(args, "--requires-approval");
  // ask-mode: remap exit codes (0 approved, 1 denied, 2 timeout, 3 config/auth,
  // 4 network/server) and suppress APPROVED/DENIED stdout so the expert's text
  // reply (if any) is the only thing that lands on stdout.
  const askMode = hasFlag(args, "--ask-mode");
  // quiet: suppress all stderr progress/status writes. Stdout is unchanged.
  const quiet = hasFlag(args, "--quiet") || hasFlag(args, "-q");
  const writeErr = (msg: string): void => {
    if (!quiet) process.stderr.write(msg);
  };
  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const timeout = parseInt(optEnv("HEYSUMMON_TIMEOUT", "900"), 10);
  const pollInterval = parseInt(optEnv("HEYSUMMON_POLL_INTERVAL", "3"), 10);
  const timeoutFallback = optEnv("HEYSUMMON_TIMEOUT_FALLBACK", "proceed_cautiously");
  const expertsFile = optEnv("HEYSUMMON_EXPERTS_FILE", "");

  // Resolve API key
  let apiKey = process.env.HEYSUMMON_API_KEY || "";

  if (expertsFile && existsSync(expertsFile)) {
    const store = new ExpertStore(expertsFile);
    if (expertArg) {
      const match = store.findByName(expertArg);
      if (match) {
        apiKey = match.apiKey;
      } else {
        writeErr(`Expert '${expertArg}' not found.\n`);
        process.exit(askMode ? 3 : 1);
      }
    } else if (!apiKey) {
      const def = store.getDefault();
      if (def) {
        apiKey = def.apiKey;
      }
    }
  }

  if (!apiKey) {
    writeErr("No API key. Set HEYSUMMON_API_KEY or register an expert.\n");
    process.exit(askMode ? 3 : 1);
  }

  // Generate ephemeral keys (Claude Code style -- no persistence needed)
  const keys = generateEphemeralKeys();
  const client = new HeySummonClient({ baseUrl, apiKey });

  writeErr("HeySummon: Submitting request to human...\n");

  // Parse context
  let messages: Array<{ role: string; content: string }> = [];
  if (contextArg) {
    try {
      messages = JSON.parse(contextArg);
    } catch {
      // ignore
    }
  }

  let result;
  try {
    result = await client.submitRequest({
      question,
      messages: messages.length > 0 ? messages : undefined,
      signPublicKey: keys.signPublicKey,
      encryptPublicKey: keys.encryptPublicKey,
      expertName: expertArg || undefined,
      requiresApproval: requiresApproval || undefined,
    });
  } catch (err) {
    if (err instanceof HeySummonHttpError && err.status === 403) {
      let parsed: { error?: string; hint?: string; ip?: string } = {};
      try { parsed = JSON.parse(err.body); } catch { /* ignore */ }

      const ip = parsed.ip || "unknown";
      const hint = parsed.hint || "";
      writeErr(
        `IP address ${ip} is not authorized for this API key.\n` +
        `${hint ? hint + "\n" : ""}` +
        `Your expert needs to allow this IP address in the HeySummon dashboard under Clients > IP Security.\n` +
        `Once allowed, re-run this command.\n`
      );
      if (askMode) {
        process.exit(3);
      }
      process.stdout.write(`IP_NOT_ALLOWED: IP address ${ip} is not authorized. Ask your expert to allow it in their HeySummon dashboard.\n`);
      return;
    }
    if (askMode) {
      if (err instanceof HeySummonHttpError && (err.status === 401 || err.status === 404)) {
        writeErr(`Auth error: ${err.message}\n`);
        process.exit(3);
      }
      writeErr(`Network/server error: ${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(4);
    }
    throw err;
  }

  if (!result.requestId) {
    writeErr(`Failed to submit request: ${JSON.stringify(result)}\n`);
    process.exit(askMode ? 4 : 1);
  }

  const ref = result.refCode || result.requestId;

  // When expert is unavailable, the platform rejects the request
  if (result.rejected) {
    const msg = result.message || "Expert is not available right now.";
    writeErr(`${msg}\n`);
    if (askMode) {
      // Rejection is an expert-unavailable server condition → treat as network/server error
      process.exit(4);
    }
    process.stdout.write(
      `EXPERT_UNAVAILABLE: ${msg}${result.nextAvailableAt ? ` Next available: ${result.nextAvailableAt}` : ""}\n`
    );
    return;
  }

  writeErr(
    `Request submitted [${ref}] -- waiting for human response...\n`
  );
  writeErr(
    `   (timeout: ${timeout}s, polling every ${pollInterval}s)\n`
  );

  // Polling loop
  let elapsed = 0;
  while (elapsed < timeout) {
    await sleep(pollInterval * 1000);
    elapsed += pollInterval;

    try {
      // Check status endpoint
      const status = await client.getRequestStatus(result.requestId);

      // Approval decision (Approve/Deny buttons)
      if (
        (status.status === "responded" || status.status === "closed") &&
        status.approvalDecision
      ) {
        writeErr(`\nHuman responded [${ref}] -- decision: ${status.approvalDecision}\n`);
        await client.ackEvent(result.requestId).catch(() => {});
        if (askMode) {
          // Also forward the expert's free-text reply on stdout, if any
          if (status.response) {
            process.stdout.write(status.response + "\n");
          }
          process.exit(status.approvalDecision === "denied" ? 1 : 0);
        }
        process.stdout.write(`${status.approvalDecision.toUpperCase()}\n`);
        return;
      }

      if (
        (status.status === "responded" || status.status === "closed") &&
        status.response
      ) {
        writeErr(`\nHuman responded [${ref}]\n`);
        process.stdout.write(status.response + "\n");
        if (askMode) process.exit(0);
        return;
      }

      // Fallback: check messages for plaintext replies
      const { messages: msgs } = await client.getMessages(result.requestId);
      const expertMsg = msgs.filter((m: DecryptedMessage) => m.from === "expert").pop();
      if (expertMsg) {
        if (expertMsg.plaintext) {
          writeErr(`\nHuman responded [${ref}]\n`);
          process.stdout.write(expertMsg.plaintext + "\n");
          await client.ackEvent(result.requestId).catch(() => {});
          if (askMode) process.exit(0);
          return;
        }
        if (expertMsg.ciphertext) {
          writeErr(`\nHuman responded [${ref}]\n`);
          await client.ackEvent(result.requestId).catch(() => {});
          if (askMode) {
            // Stdout is reserved for the expert's plaintext reply
            process.exit(0);
          }
          process.stdout.write("(encrypted response received)\n");
          return;
        }
      }
    } catch (err) {
      // polling error, continue silently (surfaced as timeout if it persists)
      if (askMode && err instanceof HeySummonHttpError && (err.status === 401 || err.status === 403)) {
        writeErr(`Auth error during poll: ${err.message}\n`);
        process.exit(3);
      }
    }

    // Progress indicator
    if (elapsed % 30 === 0) {
      writeErr(`   Still waiting... (${elapsed}s elapsed)\n`);
    }
  }

  // Report timeout to server (notifies expert, records timestamp)
  await client.reportTimeout(result.requestId).catch(() => {});

  writeErr(`\nTimeout after ${timeout}s -- no response received.\n`);
  writeErr(`   Request ref: ${ref}\n`);

  if (askMode) {
    process.exit(2);
  }

  const fallbackInstructions: Record<string, string> = {
    proceed_cautiously:
      "Proceed with the safest available option. Document all decisions made without expert input and flag them for review.",
    skip_continue:
      "Skip the blocked task and continue with other available work. Flag the skipped task for expert review later.",
    stop:
      "Stop all execution immediately. Do not proceed with any tasks until an expert responds.",
  };
  const fallbackInstruction = fallbackInstructions[timeoutFallback] || fallbackInstructions.proceed_cautiously;

  process.stdout.write(
    `TIMEOUT: No answer came back from the expert within the ${timeout}s timeout window. Request ref: ${ref}\n` +
    `FALLBACK INSTRUCTION: ${fallbackInstruction}\n`
  );
}

async function cmdAddExpert(args: string[]): Promise<void> {
  const key = getArg(args, "--key");
  const alias = getArg(args, "--alias");

  if (!key) {
    process.stderr.write("Usage: cli add-expert --key <api-key> [--alias <name>]\n");
    process.exit(1);
  }

  // Validate key prefix
  if (key.startsWith("hs_exp_") || key.startsWith("htl_exp_")) {
    process.stderr.write("This is an expert key. Use a CLIENT key (hs_cli_... or htl_...).\n");
    process.exit(1);
  }
  if (!key.startsWith("hs_cli_") && !key.startsWith("htl_")) {
    process.stderr.write("Invalid key format. Must start with 'hs_cli_' or 'htl_'.\n");
    process.exit(1);
  }

  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const expertsFile = requireEnv("HEYSUMMON_EXPERTS_FILE");

  const client = new HeySummonClient({ baseUrl, apiKey: key });
  const whoami = await client.whoami();

  const expertName = whoami.expert?.name || "";
  const expertId = whoami.expert?.id || "";

  if (!expertName) {
    process.stderr.write("Could not fetch expert info. Is the key valid?\n");
    process.exit(1);
  }

  const name = alias || expertName;
  const store = new ExpertStore(expertsFile);
  store.add({
    name,
    apiKey: key,
    expertId,
    expertName,
  });

  const count = store.load().length;
  process.stdout.write(`Expert added: ${name} (${expertName})\n`);
  process.stdout.write(`Experts registered: ${count}\n`);
}

async function cmdListExperts(): Promise<void> {
  const expertsFile = optEnv("HEYSUMMON_EXPERTS_FILE", "");

  if (!expertsFile || !existsSync(expertsFile)) {
    process.stdout.write("No experts registered yet.\n");
    return;
  }

  const store = new ExpertStore(expertsFile);
  const experts = store.load();

  if (experts.length === 0) {
    process.stdout.write("No experts registered yet.\n");
    return;
  }

  process.stdout.write(`Registered experts (${experts.length}):\n`);
  for (let i = 0; i < experts.length; i++) {
    const p = experts[i];
    const nameExtra =
      p.expertName !== p.name ? ` (expert: ${p.expertName})` : "";
    process.stdout.write(
      `  ${i + 1}. ${p.name}${nameExtra} -- key: ${p.apiKey.slice(0, 12)}...\n`
    );
  }
}

async function cmdCheckStatus(args: string[]): Promise<void> {
  const ref = getArg(args, "--ref") || args[args.indexOf("check-status") + 1];

  if (!ref) {
    process.stderr.write("Usage: cli check-status --ref <refCode|requestId>\n");
    process.exit(1);
  }

  const baseUrl = requireEnv("HEYSUMMON_BASE_URL");
  const apiKey = requireEnv("HEYSUMMON_API_KEY");
  const client = new HeySummonClient({ baseUrl, apiKey });

  try {
    const data = await client.getRequestStatus(ref);
    const icons: Record<string, string> = {
      pending: "...",
      responded: "[ok]",
      resolved: "[ok]",
      expired: "[expired]",
      cancelled: "[cancelled]",
    };
    const status = data.status || "unknown";
    process.stdout.write(`${icons[status] || "-"} Status: ${status}\n`);
    if (data.refCode) process.stdout.write(`  Ref: ${data.refCode}\n`);
    if (data.response || data.lastMessage) {
      process.stdout.write(`  Response: ${data.response || data.lastMessage}\n`);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}

async function cmdKeygen(args: string[]): Promise<void> {
  const dir = getArg(args, "--dir") || optEnv("HEYSUMMON_KEY_DIR", "");

  if (!dir) {
    process.stderr.write("Usage: cli keygen --dir <path>\n");
    process.exit(1);
  }

  const keys = generatePersistentKeys(dir);
  process.stderr.write(`Keypairs generated in ${dir}\n`);
  process.stdout.write(JSON.stringify(keys) + "\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);

const commands: Record<string, (args: string[]) => Promise<void>> = {
  "submit-and-poll": cmdSubmitAndPoll,
  "add-expert": cmdAddExpert,
  "list-experts": cmdListExperts,
  "check-status": cmdCheckStatus,
  keygen: cmdKeygen,
};

if (!command || !commands[command]) {
  process.stderr.write(
    `Usage: cli <command> [args]\n\nCommands:\n  ${Object.keys(commands).join("\n  ")}\n`
  );
  process.exit(1);
}

commands[command](rest).catch((err) => {
  process.stderr.write(
    `Error: ${err instanceof Error ? err.message : String(err)}\n`
  );
  process.exit(1);
});
