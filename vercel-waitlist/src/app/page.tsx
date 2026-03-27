"use client";

import { useState } from "react";

const colors = {
  bgDeep: "#0f1410",
  bgCard: "#1e2420",
  textHeading: "#e8e4df",
  textBody: "#9a958e",
  textMuted: "#6b6660",
  primary: "#ff826d",
  white: "#ffffff",
  borderSubtle: "rgba(255,255,255,0.1)",
  bgSubtle: "rgba(255,255,255,0.05)",
};

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
        <span style={{
          fontSize: "2.5rem",
          fontWeight: 700,
          color: colors.textHeading,
          letterSpacing: "-0.02em",
          fontFamily: "'Joti One', Georgia, serif",
        }}>
          HeySummon
        </span>
      </div>

      {/* Badge */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        border: `1px solid ${colors.borderSubtle}`,
        background: colors.bgSubtle,
        color: colors.textBody,
        borderRadius: "999px",
        padding: "0.4rem 1rem",
        fontSize: "0.8rem",
        marginBottom: "1.5rem",
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: colors.primary,
          display: "inline-block",
        }} />
        Provider platform — coming soon
      </div>

      {/* Heading */}
      <h1 style={{
        fontSize: "clamp(2rem, 5vw, 3.5rem)",
        fontWeight: 400,
        lineHeight: 1.15,
        margin: "0 0 1rem",
        maxWidth: 600,
        color: colors.textHeading,
        fontFamily: "'Joti One', Georgia, serif",
      }}>
        When AI gets stuck,{" "}
        <span style={{ color: colors.primary }}>
          you answer.
        </span>
      </h1>

      <p style={{
        color: colors.textBody,
        fontSize: "1.1rem",
        maxWidth: 480,
        lineHeight: 1.6,
        margin: "0 0 2.5rem",
      }}>
        HeySummon connects AI agents to human experts in realtime.
        Be the first to access the provider platform — join the waitlist.
      </p>

      {/* Form */}
      {status === "success" ? (
        <div style={{
          background: colors.bgSubtle,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: "1rem",
          padding: "1.5rem 2rem",
          color: colors.textHeading,
          fontSize: "1rem",
        }}>
          {message}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          width: "100%",
          maxWidth: 400,
        }}>
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
              border: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSubtle,
              color: colors.textHeading,
              fontSize: "1rem",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "'DM Sans', system-ui, sans-serif",
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
              background: status === "loading" ? colors.textMuted : colors.white,
              color: colors.bgDeep,
              fontSize: "1rem",
              fontWeight: 600,
              cursor: status === "loading" ? "default" : "pointer",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {status === "loading" ? "Joining..." : "Join Waitlist"}
          </button>
          {status === "error" && (
            <p style={{ color: colors.primary, fontSize: "0.875rem", margin: 0 }}>{message}</p>
          )}
        </form>
      )}

      {/* Footer */}
      <p style={{ marginTop: "3rem", color: colors.textMuted, fontSize: "0.8rem" }}>
        Open source · {" "}
        <a href="https://github.com/thomasansems/heysummon" style={{ color: colors.textBody, textDecoration: "none" }}>
          GitHub
        </a>{" "}
        · <a href="https://heysummon.ai" style={{ color: colors.textBody, textDecoration: "none" }}>heysummon.ai</a>
      </p>
    </main>
  );
}
