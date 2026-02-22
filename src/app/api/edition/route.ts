import { NextResponse } from "next/server";
import { isCloud, EDITION } from "@/lib/edition";

export async function GET() {
  return NextResponse.json({ edition: EDITION, isCloud: isCloud() });
}
