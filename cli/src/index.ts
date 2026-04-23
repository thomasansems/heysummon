import { init } from "./commands/init";
import { start } from "./commands/start";
import { stop } from "./commands/stop";
import { status } from "./commands/status";
import { update } from "./commands/update";
import { uninstall } from "./commands/uninstall";
import { ask } from "./commands/ask";

// Version is injected from package.json at build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const VERSION: string = (require("../package.json") as { version: string }).version;

const KNOWN_COMMANDS = new Set([
  "init",
  "start",
  "stop",
  "status",
  "update",
  "uninstall",
  "ask",
]);

function printHelp(): void {
  console.log(`
  HeySummon CLI v${VERSION}
  Human-in-the-loop for AI agents

  Usage:
    heysummon "<question>"            Ask a human, gate a shell command (one-liner)
    heysummon [command] [options]

  Commands:
    ask           Ask a human a question and block on the decision
    init          Install and configure HeySummon (default for flags)
    start         Start the HeySummon server
    stop          Stop the HeySummon server
    status        Check server status
    update        Update to the latest version
    uninstall     Remove all HeySummon data and stop the server

  Options:
    --help, -h    Show this help message
    --version, -v Show version number

  Ask options:
    --timeout <duration>   How long to wait (default: 5m; e.g. 30s, 10m, 1h)
    --channel <name>       Route to a specific expert by name (optional)
    -q, --quiet            Suppress progress output on stderr
    --require approve      Require explicit approve/deny (default)

  Ask env vars:
    HEYSUMMON_API_KEY      Your client API key (required)
    HEYSUMMON_BASE_URL     Your HeySummon instance URL (required)
                           Also read from ~/.heysummon/.env as a convenience

  Ask exit codes:
    0  approved            (expert reply printed on stdout, if any)
    1  denied
    2  timeout
    3  config / auth error (missing creds, bad flag, invalid key)
    4  network / server error

  Init options:
    --yes, -y              Use defaults, skip prompts (quickstart)
    --from-source <dir>    Copy from local directory instead of downloading

  Start options:
    --daemon, -d           Run server in background

  Examples:
    heysummon "Proceed?" && ./deploy.sh prod
    reply=$(heysummon -q "Which channel?") && slack-post "$reply" done
    npx @heysummon/app              # First-time setup (interactive)
    npx @heysummon/app --yes        # Quickstart with defaults
    npx @heysummon/app start -d     # Start in background
    npx @heysummon/app status       # Check if running
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const first = args[0];

  // Global flags
  if (first === "--help" || first === "-h") {
    printHelp();
    return;
  }
  if (first === "--version" || first === "-v") {
    console.log(VERSION);
    return;
  }

  // Route:
  //   - no arg / flag-first → init (back-compat with install flow)
  //   - known subcommand    → that command
  //   - anything else       → positional sugar for `ask <that string>`
  let command: string;
  let rest: string[];
  if (!first || first.startsWith("-")) {
    command = "init";
    rest = args;
  } else if (KNOWN_COMMANDS.has(first)) {
    command = first;
    rest = args.slice(1);
  } else {
    command = "ask";
    rest = args; // pass the question + any trailing flags
  }

  try {
    const yes = args.includes("--yes") || args.includes("-y");
    const fromSourceIdx = args.indexOf("--from-source");
    const fromSource = fromSourceIdx !== -1 ? args[fromSourceIdx + 1] : undefined;

    switch (command) {
      case "init":
        await init({ yes, fromSource });
        break;
      case "start":
        await start(rest);
        break;
      case "stop":
        await stop();
        break;
      case "status":
        await status();
        break;
      case "update":
        await update();
        break;
      case "uninstall":
        await uninstall();
        break;
      case "ask": {
        const code = await ask(rest);
        process.exit(code);
      }
      default:
        console.log(`  Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error(`\n  Error: ${err.message}`);
    } else {
      console.error("\n  An unexpected error occurred");
    }
    process.exit(1);
  }
}

main();
