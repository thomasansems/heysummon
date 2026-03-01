import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { email } = await request.json().catch(() => ({}));

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const LOOPS_API_KEY = process.env.LOOPS_API_KEY;
  const LOOPS_LIST_ID = process.env.LOOPS_WAITLIST_LIST_ID;

  if (!LOOPS_API_KEY) {
    console.error("LOOPS_API_KEY not configured");
    return NextResponse.json({ error: "Waitlist not configured" }, { status: 500 });
  }

  try {
    const body: Record<string, unknown> = {
      email,
      source: "waitlist-cloud",
      subscribed: true,
      userGroup: "waitlist-cloud",
    };

    if (LOOPS_LIST_ID) {
      body.mailingLists = { [LOOPS_LIST_ID]: true };
    }

    const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOOPS_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    // Loops returns 409 for duplicate — treat as success (already on list)
    if (res.ok || res.status === 409) {
      return NextResponse.json({ success: true });
    }

    console.error("Loops API error:", res.status, data);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  } catch (err) {
    console.error("Waitlist error:", err);
    return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
  }
}
