"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "You're on the list!");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem",
      textAlign: "center",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: "2rem" }}>
        <span style={{ fontSize: "2.5rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          hey<span style={{ color: "#a78bfa" }}>Summon</span>
        </span>
      </div>

      {/* Badge */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        border: "1px solid rgba(139,92,246,0.3)",
        background: "rgba(139,92,246,0.1)",
        color: "#c4b5fd",
        borderRadius: "999px",
        padding: "0.4rem 1rem",
        fontSize: "0.8rem",
        marginBottom: "1.5rem",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
        Provider platform — coming soon
      </div>

      {/* Heading */}
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", fontWeight: 700, lineHeight: 1.15, margin: "0 0 1rem", maxWidth: 600 }}>
        When AI gets stuck,{" "}
        <span style={{ background: "linear-gradient(to right, #a78bfa, #e879f9)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          you answer.
        </span>
      </h1>

      <p style={{ color: "#a1a1aa", fontSize: "1.1rem", maxWidth: 480, lineHeight: 1.6, margin: "0 0 2.5rem" }}>
        HeySummon connects AI agents to human experts in realtime. Be the first to access the provider platform — join the waitlist.
      </p>

      {/* Form */}
      {status === "success" ? (
        <div style={{
          background: "rgba(139,92,246,0.1)",
          border: "1px solid rgba(139,92,246,0.3)",
          borderRadius: "1rem",
          padding: "1.5rem 2rem",
          color: "#c4b5fd",
          fontSize: "1rem",
        }}>
          🎉 {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", width: "100%", maxWidth: 400 }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={{
              width: "100%",
              padding: "0.85rem 1.25rem",
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: "1rem",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <button
            type="submit"
            disabled={status === "loading"}
            style={{
              width: "100%",
              padding: "0.85rem",
              borderRadius: "999px",
              border: "none",
              background: status === "loading" ? "#6d28d9" : "#7c3aed",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: status === "loading" ? "default" : "pointer",
            }}
          >
            {status === "loading" ? "Joining..." : "Join Waitlist →"}
          </button>
          {status === "error" && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", margin: 0 }}>{message}</p>
          )}
        </form>
      )}

      {/* Footer */}
      <p style={{ marginTop: "3rem", color: "#52525b", fontSize: "0.8rem" }}>
        Open source ·{" "}
        <a href="https://github.com/thomasansems/heysummon" style={{ color: "#71717a", textDecoration: "underline" }}>
          GitHub
        </a>{" "}
        · <a href="https://heysummon.ai" style={{ color: "#71717a", textDecoration: "underline" }}>heysummon.ai</a>
      </p>
    </main>
  );
}
