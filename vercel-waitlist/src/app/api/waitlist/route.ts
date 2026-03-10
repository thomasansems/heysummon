import { NextRequest, NextResponse } from "next/server";

const LOOPS_API_KEY = process.env.LOOPS_API_KEY || "";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();

    // Use indexOf-based validation instead of regex to avoid ReDoS on uncontrolled input
    const isValidEmail = (e: string) => {
      const at = e.indexOf("@");
      if (at < 1) return false;
      const dot = e.lastIndexOf(".");
      return dot > at + 1 && dot < e.length - 1;
    };
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    if (!LOOPS_API_KEY) {
      return NextResponse.json({ error: "Waitlist not configured." }, { status: 500 });
    }

    const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify({
        email,
        source: "heysummon-provider-waitlist",
        subscribed: true,
        userGroup: "provider-waitlist",
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      if (text.includes("already")) {
        return NextResponse.json({ message: "You're already on the waitlist!" }, { status: 200 });
      }
      return NextResponse.json({ error: "Failed to join waitlist." }, { status: 500 });
    }

    return NextResponse.json({ message: "You're on the list! We'll be in touch soon." }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
