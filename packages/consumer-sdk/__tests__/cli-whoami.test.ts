import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

/**
 * Integration test for the `whoami` subcommand on the consumer SDK CLI.
 * The CLI is spawned as a child process, so we stand up a real localhost
 * HTTP server (MSW only intercepts in-process) and point the CLI at it.
 */

const cliPath = resolve(__dirname, "../dist/cli.js");

let server: Server;
let baseUrl: string;
let lastHeaders: Record<string, string | string[] | undefined> = {};

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/api/v1/whoami") {
      lastHeaders = req.headers;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          keyId: "kid-whoami",
          keyName: "cli-test",
          expert: { id: "exp-cli", name: "CliExpert", isActive: true },
          owner: { id: "owner-cli", name: "CliOwner" },
        })
      );
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], env: Record<string, string>): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", reject);
    child.on("close", (code) => resolve({ status: code, stdout, stderr }));
    setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("CLI timed out"));
    }, 10000);
  });
}

describe("cli whoami", () => {
  it("calls /api/v1/whoami with --key and prints the JSON", async () => {
    const result = await runCli(["whoami", "--key", "hs_cli_wtest"], {
      HEYSUMMON_BASE_URL: baseUrl,
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout.trim().split("\n").pop()!);
    expect(parsed.keyId).toBe("kid-whoami");
    expect(parsed.expert.name).toBe("CliExpert");
    expect(lastHeaders["x-api-key"]).toBe("hs_cli_wtest");
  });

  it("exits non-zero when no API key resolution path succeeds", async () => {
    const result = await runCli(["whoami"], {
      HEYSUMMON_BASE_URL: baseUrl,
      HEYSUMMON_API_KEY: "",
      HEYSUMMON_EXPERTS_FILE: "/nonexistent-experts-file.json",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/No API key/);
  });
});
