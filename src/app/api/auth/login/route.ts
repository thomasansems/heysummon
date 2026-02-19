import { NextResponse } from "next/server";

// Legacy route — OAuth is now used via /api/auth/[...nextauth]
export async function POST() {
  return NextResponse.json(
    { error: "Password login is deprecated. Please use OAuth." },
    { status: 410 }
  );
}
