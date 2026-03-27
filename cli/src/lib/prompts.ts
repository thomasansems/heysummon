import * as p from "@clack/prompts";
import pc from "picocolors";

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }
}

export async function ask(
  message: string,
  defaultValue?: string
): Promise<string> {
  const value = await p.text({
    message,
    defaultValue,
    placeholder: defaultValue,
  });
  handleCancel(value);
  // After handleCancel, value is guaranteed to be string (not symbol)
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
}

export async function askYesNo(
  message: string,
  defaultValue: boolean = true
): Promise<boolean> {
  const value = await p.confirm({
    message,
    initialValue: defaultValue,
  });
  handleCancel(value);
  return Boolean(value);
}

export async function askSecret(message: string): Promise<string> {
  const value = await p.password({
    message,
  });
  handleCancel(value);
  return String(value);
}

export async function askConfirmText(
  message: string,
  expected: string
): Promise<boolean> {
  const value = await p.text({
    message,
    placeholder: expected,
    validate: (v) => {
      if (v !== expected) {
        return `Type ${pc.bold(expected)} to confirm, or press Ctrl+C to cancel.`;
      }
    },
  });
  handleCancel(value);
  return String(value) === expected;
}
