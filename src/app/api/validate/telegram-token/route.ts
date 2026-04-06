import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateBotToken } from "@/lib/adapters/telegram";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const raw = await request.json().catch(() => ({}));
  const token = typeof raw?.botToken === "string" ? raw.botToken.trim() : "";

  if (!token) {
    return NextResponse.json({ valid: false, error: "Bot token is required" }, { status: 400 });
  }

  const result = await validateBotToken(token);
  return NextResponse.json(result);
}
