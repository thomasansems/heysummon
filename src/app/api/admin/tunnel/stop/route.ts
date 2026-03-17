import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ENV_PATH = path.resolve(process.cwd(), ".env.local");

function removeEnvVar(key: string) {
  try {
    const content = fs.readFileSync(ENV_PATH, "utf8");
    const updated = content.replace(new RegExp(`^${key}=.*\n?`, "m"), "");
    fs.writeFileSync(ENV_PATH, updated, "utf8");
  } catch { /* ignore */ }
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    execSync("tailscale funnel --https=443 off", { timeout: 10000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to stop funnel: ${msg}` }, { status: 500 });
  }

  removeEnvVar("HEYSUMMON_PUBLIC_URL");
  delete process.env.HEYSUMMON_PUBLIC_URL;

  return NextResponse.json({ ok: true });
}
