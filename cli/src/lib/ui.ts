import pc from "picocolors";

export const color = {
  bold: (s: string) => pc.bold(s),
  dim: (s: string) => pc.dim(s),
  green: (s: string) => pc.green(s),
  yellow: (s: string) => pc.yellow(s),
  cyan: (s: string) => pc.cyan(s),
  magenta: (s: string) => pc.magenta(s),
  red: (s: string) => pc.red(s),
  blue: (s: string) => pc.blue(s),
  boldCyan: (s: string) => pc.bold(pc.cyan(s)),
  boldGreen: (s: string) => pc.bold(pc.green(s)),
  boldYellow: (s: string) => pc.bold(pc.yellow(s)),
};

// Primary brand color = yellow (matches #fdb15f from the web UI)
const brand = (s: string) => pc.bold(pc.yellow(s));

const BANNER = `
 ${brand("  _                                                          ")}
 ${brand(" | |__   ___ _   _   ___ _   _ _ __ ___  _ __ ___   ___  _ __")}
 ${brand(" |  _ \\ / _ \\ | | | / __| | | | '_ ` _ \\| '_ ` _ \\ / _ \\| '_ \\")}
 ${brand(" | | | |  __/ |_| | \\__ \\ |_| | | | | | | | | | | | (_) | | | |")}
 ${brand(" |_| |_|\\___|\\__, | |___/\\__,_|_| |_| |_|_| |_| |_|\\___/|_| |_|")}
 ${brand("             |___/                                            ")}
`;

const SUMMON_LINES = [
  "hey summon Thomas About to delete 847 prod records. You sure about that?",
  "hey summon Sarah Found a $200 cheaper flight. It leaves at 4:47 AM though.",
  "hey summon Mark Email draft says 'As per my last email'. Send it like that?",
  "hey summon Lisa New vendor invoice: $2,400. Never seen this account before.",
  "hey summon Thomas Customer wants a refund from 8 months ago. Policy says 30 days.",
  "hey summon James Ad budget is gone. Pause everything or throw in another $500?",
  "hey summon Anna That PR has 6 major issues. Post the honest review or sugarcoat it?",
  "hey summon Sarah Customer is furious and I'm 3 messages deep. Tag in?",
  "hey summon Elon Wrote a rejection email. The applicant seems really excited though.",
  "hey summon Thomas You said 'update the homepage'. I have 4 interpretations of that.",
  "hey summon Lisa 'Make it faster' — load time, response time, or vibes?",
  "hey summon Mark 'Reach out to last month's leads' — that's 214 people. All of them?",
  "hey summon Anna Two Thomas Ansems in the CRM. Gonna need you to pick one.",
  "hey summon James API key expires tomorrow. Renew the old one or start fresh?",
  "hey summon Sarah Found a note: 'don't contact Mark until after holidays'. Is it after?",
  "hey summon Thomas Tried solving this for 47 iterations. I officially give up. Help?",
  "hey summon Elon You said 'surprise me' with the design. Wanna preview or just send it?",
  "hey summon Lisa User says your product 'changed their life'. Ask for a testimonial?",
  "hey summon Mark Wrote 6 apology emails. They all sound passive-aggressive somehow.",
  "hey summon Anna Code comment says 'DO NOT CHANGE'. But you just asked me to change it.",
];

const ANIMATION_CYCLES = 2;
const TYPE_DELAY_MS = 22;
const ERASE_DELAY_MS = 10;
const PAUSE_AFTER_LINE_MS = 1400;
const PAUSE_AFTER_ERASE_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isInteractive(): boolean {
  return Boolean(process.stdout.isTTY && !process.env.CI);
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseSummonLine(line: string): { name: string; question: string } {
  const parts = line.split(" ");
  return { name: parts[2], question: parts.slice(3).join(" ") };
}

function getMaxTypedChars(): number {
  const cols = process.stdout.columns || 80;
  // "  > hey summon " = 16 visible chars
  return cols - 16;
}

// The static prefix that never gets erased
const PROMPT_PREFIX = `  ${pc.dim(">")} ${pc.bold(pc.yellow("hey summon"))} `;

function renderLine(typedChars: string): void {
  process.stdout.write(`\r\x1b[K${PROMPT_PREFIX}${typedChars}`);
}

export async function printAnimatedBanner(): Promise<void> {
  console.log(BANNER);
  console.log(`  ${pc.dim("AI does the work. Humans make the calls. Self-Hosted Human-in-the-loop")}`);
  console.log("");

  if (!isInteractive()) {
    const line = SUMMON_LINES[Math.floor(Math.random() * SUMMON_LINES.length)];
    const { name, question } = parseSummonLine(line);
    renderLine(`${pc.bold(name)} ${pc.dim(question)}`);
    console.log("");
    console.log("");
    return;
  }

  const order = shuffled(SUMMON_LINES);
  const maxChars = getMaxTypedChars();

  // Show the static prefix
  renderLine("");

  for (let i = 0; i < ANIMATION_CYCLES; i++) {
    const { name, question } = parseSummonLine(order[i % order.length]);
    const fullText = `${name} ${question}`;

    // Truncate if needed
    const displayText = fullText.length > maxChars - 3
      ? fullText.slice(0, maxChars - 3) + "..."
      : fullText;

    // Type forward character by character
    const chars = [...displayText];
    for (let c = 0; c < chars.length; c++) {
      const typed = displayText.slice(0, c + 1);
      // Name part stays bold, question part is dim
      const nameEnd = name.length;
      if (c < nameEnd) {
        renderLine(pc.bold(typed));
      } else {
        renderLine(`${pc.bold(name)} ${pc.dim(typed.slice(nameEnd + 1))}`);
      }
      await sleep(TYPE_DELAY_MS);
    }

    // Pause to read
    await sleep(PAUSE_AFTER_LINE_MS);

    // Backspace erase (skip on last cycle — keep final text visible)
    if (i < ANIMATION_CYCLES - 1) {
      for (let c = chars.length; c > 0; c--) {
        const typed = displayText.slice(0, c - 1);
        const nameEnd = name.length;
        if (c - 1 <= 0) {
          renderLine("");
        } else if (c - 1 <= nameEnd) {
          renderLine(pc.bold(typed));
        } else {
          renderLine(`${pc.bold(name)} ${pc.dim(typed.slice(nameEnd + 1))}`);
        }
        await sleep(ERASE_DELAY_MS);
      }
      await sleep(PAUSE_AFTER_ERASE_MS);
    }
  }

  console.log("");
  console.log("");
}

export function printBannerStatic(): void {
  console.log(BANNER);
  console.log(`  ${pc.dim("AI does the work. Humans make the calls. Self-Hosted Human-in-the-loop")}`);
  console.log("");
  const { name, question } = parseSummonLine(SUMMON_LINES[0]);
  console.log(`${PROMPT_PREFIX}${pc.bold(name)} ${pc.dim(question)}`);
  console.log("");
}

export function printSuccess(msg: string): void {
  console.log(`  ${pc.green("✓")} ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`  ${pc.dim("·")} ${msg}`);
}

export function printWarning(msg: string): void {
  console.log(`  ${pc.yellow("⚠")} ${msg}`);
}

export function printError(msg: string): void {
  console.log(`  ${pc.red("✗")} ${msg}`);
}

export function printDivider(): void {
  console.log(`  ${pc.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
}
