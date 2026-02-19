import { NextResponse } from "next/server";

// Legacy route — use NextAuth signOut instead
export async function POST() {
  return NextResponse.json({ ok: true });
}
