import { NextResponse } from "next/server";

// Legacy route — OAuth auto-creates accounts
export async function POST() {
  return NextResponse.json(
    { error: "Signup is deprecated. Please use OAuth." },
    { status: 410 }
  );
}
