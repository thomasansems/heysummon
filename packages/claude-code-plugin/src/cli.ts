#!/usr/bin/env node
import { summon } from "./summon.js";
import {
  SummonConfigError,
  SummonRejectedError,
  SummonTimeoutError,
} from "./errors.js";

interface ParsedArgs {
  question?: string;
  expertName?: string;
  requiresApproval: boolean;
  help: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { requiresApproval: false, help: false };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        out.help = true;
        break;
      case "--expert":
      case "-e":
        out.expertName = argv[++i];
        break;
      case "--requires-approval":
        out.requiresApproval = true;
        break;
      default:
        if (typeof arg === "string") positional.push(arg);
    }
  }

  if (positional.length > 0) out.question = positional.join(" ");
  return out;
}

const USAGE = `Usage: heysummon-summon [--expert <name>] [--requires-approval] <question...>

Environment:
  HEYSUMMON_API_KEY   required consumer API key
  HEYSUMMON_URL       required platform base URL
  HEYSUMMON_TIMEOUT   optional poll timeout in seconds (default 900)

Options:
  --expert, -e <name>     target a named expert registered for this API key
  --requires-approval     request a yes/no decision (Approve/Deny buttons)
  --help, -h              show this message
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.question) {
    process.stdout.write(USAGE);
    process.exit(args.help ? 0 : 2);
  }

  try {
    const result = await summon({
      question: args.question,
      expertName: args.expertName,
      requiresApproval: args.requiresApproval,
    });
    process.stdout.write(`${result.response}\n`);
    process.exit(0);
  } catch (err) {
    if (err instanceof SummonConfigError) {
      process.stderr.write(`Configuration error: ${err.message}\n`);
      process.exit(2);
    }
    if (err instanceof SummonRejectedError) {
      process.stderr.write(
        `Request rejected (status=${err.status}${err.reason ? `, reason=${err.reason}` : ""}): ${err.message}\n`
      );
      process.exit(3);
    }
    if (err instanceof SummonTimeoutError) {
      process.stderr.write(
        `Request timed out after ${err.elapsedMs}ms (requestId=${err.requestId}, lastKnownStatus=${err.lastKnownStatus})\n`
      );
      process.exit(4);
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Unexpected error: ${message}\n`);
    process.exit(1);
  }
}

void main();
