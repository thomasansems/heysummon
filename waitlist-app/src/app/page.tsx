"use client";

import { useState } from "react";

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setStatus("success");
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Something went wrong. Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-8">
          <span className="text-3xl font-bold tracking-tight text-black">
            hey<span className="text-violet-600">Summon</span>
          </span>
        </div>

        {status === "success" ? (
          <div className="rounded-xl border border-[#eaeaea] bg-white p-8">
            <div className="mb-4 text-4xl">🎉</div>
            <h2 className="mb-2 text-xl font-semibold text-black">You&apos;re on the list!</h2>
            <p className="text-sm text-[#666]">
              We&apos;ll notify you as soon as HeySummon Cloud is ready. Stay tuned!
            </p>
          </div>
        ) : (
          <>
            <h1 className="mb-3 text-3xl font-bold text-black">
              Coming soon
            </h1>
            <p className="mb-8 text-[#666]">
              HeySummon Cloud is almost ready. Join the waitlist and be the first to know when we launch.
            </p>

            <div className="rounded-xl border border-[#eaeaea] bg-white p-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="email"
                  required
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  className="w-full rounded-lg border border-[#eaeaea] px-4 py-3 text-sm text-black outline-none transition-colors placeholder:text-[#999] focus:border-black disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={status === "loading" || !email}
                  className="w-full rounded-lg bg-black py-3 text-sm font-semibold text-white transition-colors hover:bg-black/80 disabled:opacity-50"
                >
                  {status === "loading" ? "Joining..." : "Join the waitlist"}
                </button>
                {status === "error" && (
                  <p className="text-xs text-red-500">{errorMsg}</p>
                )}
              </form>
            </div>

            <p className="mt-6 text-xs text-[#999]">
              No spam. Unsubscribe anytime.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
