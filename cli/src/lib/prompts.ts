import * as readline from "readline";

function createInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function ask(question: string, defaultValue?: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();
    const prompt = defaultValue
      ? `  ${question} (${defaultValue}): `
      : `  ${question}: `;
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

export function askYesNo(
  question: string,
  defaultValue: boolean = true
): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface();
    const hint = defaultValue ? "Y/n" : "y/N";
    rl.question(`  ${question} (${hint}): `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === "") {
        resolve(defaultValue);
      } else {
        resolve(trimmed === "y" || trimmed === "yes");
      }
    });
  });
}

export function askSecret(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface();
    rl.question(`  ${question}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
