// ANSI color helpers — no dependencies needed
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgBlack: "\x1b[40m",
};

export const color = {
  bold: (s: string) => `${c.bold}${s}${c.reset}`,
  dim: (s: string) => `${c.dim}${s}${c.reset}`,
  green: (s: string) => `${c.green}${s}${c.reset}`,
  yellow: (s: string) => `${c.yellow}${s}${c.reset}`,
  cyan: (s: string) => `${c.cyan}${s}${c.reset}`,
  magenta: (s: string) => `${c.magenta}${s}${c.reset}`,
  red: (s: string) => `${c.red}${s}${c.reset}`,
  blue: (s: string) => `${c.blue}${s}${c.reset}`,
  boldCyan: (s: string) => `${c.bold}${c.cyan}${s}${c.reset}`,
  boldGreen: (s: string) => `${c.bold}${c.green}${s}${c.reset}`,
  boldYellow: (s: string) => `${c.bold}${c.yellow}${s}${c.reset}`,
};

export function printBanner(): void {
  console.log("");
  console.log(`  ${color.boldCyan("🦞 HeySummon")} ${color.dim("v0.1.0-alpha")}`);
  console.log(`  ${color.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
  console.log(`  ${color.bold("Human-in-the-Loop for AI agents")}`);
  console.log("");
  console.log(`  ${color.dim("Docs:")} ${color.cyan("https://docs.heysummon.ai")}`);
  console.log(`  ${color.dim("Repo:")} ${color.cyan("https://github.com/thomasansems/heysummon")}`);
  console.log("");
}

export function printStep(n: number, total: number, label: string): void {
  console.log("");
  console.log(`  ${color.boldCyan(`[${n}/${total}]`)} ${color.bold(label)}`);
}

export function printSuccess(msg: string): void {
  console.log(`  ${color.green("✓")} ${msg}`);
}

export function printInfo(msg: string): void {
  console.log(`  ${color.dim("·")} ${msg}`);
}

export function printWarning(msg: string): void {
  console.log(`  ${color.yellow("⚠")} ${msg}`);
}

export function printError(msg: string): void {
  console.log(`  ${color.red("✗")} ${msg}`);
}

export function printDivider(): void {
  console.log(`  ${color.dim("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")}`);
}
