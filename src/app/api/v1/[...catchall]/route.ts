import { NextResponse } from "next/server";

/**
 * Catch-all for unknown /api/v1/* routes.
 * Returns JSON 404 instead of Next.js HTML 404 page.
 * This keeps Content-Type consistent for API consumers and security scanners.
 */
export async function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function PUT() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function PATCH() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
export async function DELETE() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
