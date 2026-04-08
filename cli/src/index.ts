import { init } from "./commands/init";
import { start } from "./commands/start";
import { stop } from "./commands/stop";
import { status } from "./commands/status";
import { update } from "./commands/update";
import { uninstall } from "./commands/uninstall";

// Version is injected from package.json at build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const VERSION: string = (require("../package.json") as { version: string }).version;

function printHelp(): void {
  console.log(`
  HeySummon CLI v${VERSION}
  Human-in-the-loop for AI agents

  Usage:
    heysummon [command] [options]

  Commands:
    init          Install and configure HeySummon (default)
    start         Start the HeySummon server
    stop          Stop the HeySummon server
    status        Check server status
    update        Update to the latest version
    uninstall     Remove all HeySummon data and stop the server

  Options:
    --help, -h    Show this help message
    --version, -v Show version number

  Init options:
    --yes, -y              Use defaults, skip prompts (quickstart)
    --from-source <dir>    Copy from local directory instead of downloading

  Start options:
    --daemon, -d  Run server in background

  Examples:
    npx @heysummon/app              # First-time setup (interactive)
    npx @heysummon/app --yes        # Quickstart with defaults
    npx @heysummon/app start -d     # Start in background
    npx @heysummon/app status       # Check if running
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  // If first arg is a flag (starts with -), default to "init"
  const command = (!args[0] || args[0].startsWith("-")) ? "init" : args[0];

  if (command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
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
        await start(args.slice(1));
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
