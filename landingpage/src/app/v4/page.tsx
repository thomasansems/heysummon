// V4: THE ARENA
// Brutalist / terminal developer aesthetic. High contrast monochrome.
// Brand gradient used sparingly as the only color accent.
// Monospace-heavy. Grid-based. Developer-first. No soft edges.
//
// Design tokens — change here to restyle V4:
// --v4-bg:       #000000  (pure black)
// --v4-surface:  #0A0A0A  (near-black surface)
// --v4-border:   #262626  (dark border)
// --v4-text:     #FAFAFA  (near-white text)
// --v4-muted:    #737373  (muted neutral)
// --v4-green:    #22C55E  (terminal green)
// --v4-gradient: linear-gradient(135deg, #FF6B4A, #4A8FE7)

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

function GradientBar() {
  return (
    <div style={{ height: "2px", background: "linear-gradient(90deg, #FF6B4A, #4A8FE7)", width: "100%" }} />
  );
}

function TerminalPrompt({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem" }}>
      <span style={{ color: "#22C55E" }}>~</span>
      <span style={{ color: "#737373" }}> $ </span>
      <span style={{ color: "#FAFAFA" }}>{children}</span>
    </span>
  );
}

export default function V4Arena() {
  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background: "#000000",
        color: "#FAFAFA",
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
      }}
    >
      {/* --- NAV --- */}
      <GradientBar />
      <header
        style={{
          borderBottom: "1px solid #262626",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(0,0,0,0.95)",
          backdropFilter: "blur(12px)",
        }}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a
            href="/"
            style={{
              fontWeight: 800,
              fontSize: "1rem",
              fontFamily: "'JetBrains Mono', monospace",
              background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            heysummon
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href}
                style={{ color: "#737373", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace" }}
                className="hover:text-[#FAFAFA] transition-colors">
                {link.label.toLowerCase()}
              </a>
            ))}
          </div>
          <a
            href={nav.cta.href}
            style={{
              border: "1px solid #FF6B4A",
              color: "#FF6B4A",
              fontWeight: 600,
              fontSize: "0.8rem",
              padding: "0.45rem 1rem",
              fontFamily: "'JetBrains Mono', monospace",
            }}
            className="hover:bg-[#FF6B4A] hover:text-black transition-all"
          >
            {nav.cta.label.toLowerCase()}
          </a>
        </nav>
      </header>

      {/* --- HERO --- */}
      <section
        className="relative"
        style={{ minHeight: "90vh", display: "flex", alignItems: "center", borderBottom: "1px solid #262626" }}
      >
        {/* Grid pattern background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#26262640 1px, transparent 1px), linear-gradient(90deg, #26262640 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: "500px",
            height: "400px",
            background: "radial-gradient(ellipse, rgba(255,107,74,0.08) 0%, rgba(74,143,231,0.04) 40%, transparent 70%)",
          }}
        />

        <div className="max-w-5xl mx-auto px-6 py-24 w-full relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              {/* Terminal-style badge */}
              <div style={{ marginBottom: "2rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    border: "1px solid #262626",
                    padding: "0.35rem 0.85rem",
                    fontSize: "0.75rem",
                    color: "#22C55E",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  v0.1.0 &middot; {hero.badge.toLowerCase()}
                </span>
              </div>

              <h1
                style={{
                  fontSize: "clamp(3rem, 7vw, 5.5rem)",
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: "-0.05em",
                  fontFamily: "'Inter', system-ui, sans-serif",
                  marginBottom: "2rem",
                }}
              >
                <span style={{ color: "#FAFAFA" }}>Hey</span>
                <br />
                <span
                  style={{
                    background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  summon.
                </span>
              </h1>

              <p
                style={{
                  fontSize: "1rem",
                  lineHeight: 1.7,
                  color: "#737373",
                  maxWidth: "540px",
                  marginBottom: "3rem",
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {hero.description}
              </p>

              {/* Terminal-style CTA */}
              <div
                style={{
                  background: "#0A0A0A",
                  border: "1px solid #262626",
                  maxWidth: "440px",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #262626", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF6B4A" }} />
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFD166" }} />
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E" }} />
                  <span style={{ fontSize: "0.7rem", color: "#525252", marginLeft: "0.5rem" }}>terminal</span>
                </div>
                <div style={{ padding: "1.25rem" }}>
                  <a href={hero.ctas[0].href} className="block hover:opacity-80 transition-opacity">
                    <TerminalPrompt>{hero.ctas[0].label}</TerminalPrompt>
                  </a>
                  <p style={{ fontSize: "0.7rem", color: "#525252", marginTop: "0.5rem" }}>
                    No Docker. No Git. Running in 2 minutes.
                  </p>
                </div>
              </div>

              <a
                href={hero.ctas[1].href}
                style={{
                  color: "#737373",
                  fontSize: "0.8rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  borderBottom: "1px solid #262626",
                  paddingBottom: "0.15rem",
                }}
                className="hover:text-[#FAFAFA] hover:border-[#FAFAFA] transition-all"
              >
                {hero.ctas[1].label.toLowerCase()} &rarr;
              </a>
            </div>

            {/* Image — harsh border, grid overlay, brutalist treatment */}
            <div style={{ position: "relative" }}>
              <div style={{ border: "1px solid #262626", overflow: "hidden", position: "relative" }}>
                <img
                  src="/sumo-hero.jpeg"
                  alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    filter: "contrast(1.1) saturate(0.85)",
                  }}
                />
                {/* Grid overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: "linear-gradient(#00000030 1px, transparent 1px), linear-gradient(90deg, #00000030 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                    mixBlendMode: "multiply",
                  }}
                />
                {/* Bottom gradient fade to black */}
                <div
                  className="absolute bottom-0 left-0 right-0"
                  style={{
                    height: "40%",
                    background: "linear-gradient(transparent, #000000)",
                  }}
                />
              </div>
              {/* Label underneath */}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px solid #262626" }}>
                <span style={{ fontSize: "0.65rem", color: "#525252", fontFamily: "'JetBrains Mono', monospace" }}>sumo-hero.jpeg</span>
                <span style={{ fontSize: "0.65rem", color: "#525252", fontFamily: "'JetBrains Mono', monospace" }}>neo-ukiyo-e</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #262626" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>01</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {problem.eyebrow}
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "2rem",
              color: "#FAFAFA",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {problem.headline}
          </h2>

          <blockquote
            style={{
              borderLeft: "2px solid #FF6B4A",
              paddingLeft: "1.5rem",
              marginBottom: "2.5rem",
              color: "#737373",
              fontStyle: "italic",
              fontSize: "1rem",
            }}
          >
            {problem.callout}
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ color: "#737373", lineHeight: 1.8, fontSize: "0.95rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #262626", background: "#0A0A0A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>02</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {howItWorks.eyebrow}
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "3rem",
              color: "#FAFAFA",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {howItWorks.headline}
          </h2>

          <div className="grid md:grid-cols-3 gap-0" style={{ border: "1px solid #262626" }}>
            {howItWorks.steps.map((step, i) => (
              <div
                key={i}
                style={{
                  padding: "2rem",
                  borderRight: i < 2 ? "1px solid #262626" : "none",
                }}
              >
                <div style={{ marginBottom: "1.5rem" }}>
                  <span
                    style={{
                      fontSize: "2.5rem",
                      fontWeight: 900,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      lineHeight: 1,
                    }}
                  >
                    {step.number}
                  </span>
                </div>
                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.75rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "0.8rem", color: "#737373", lineHeight: 1.7, fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {step.description}
                </p>
                {step.code && (
                  <pre
                    style={{
                      marginTop: "1rem",
                      background: "#000000",
                      border: "1px solid #262626",
                      padding: "0.75rem 1rem",
                      fontSize: "0.72rem",
                      color: "#22C55E",
                      fontFamily: "'JetBrains Mono', monospace",
                      overflow: "auto",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.7,
                    }}
                  >
                    {step.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FEATURES --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #262626" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>03</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              features
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-0" style={{ border: "1px solid #262626" }}>
            {features.map((feat, i) => (
              <div
                key={feat.id}
                style={{
                  padding: "2rem",
                  borderRight: i % 2 === 0 ? "1px solid #262626" : "none",
                  borderBottom: i < 2 ? "1px solid #262626" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
                  <span style={{ color: "#22C55E", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace" }}>
                    [{feat.id}]
                  </span>
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.6rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: "0.85rem", color: "#737373", lineHeight: 1.7, marginBottom: "1rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {feat.description}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#525252", fontFamily: "'JetBrains Mono', monospace" }}>
                  {feat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INSTALL --- */}
      <section id="install" style={{ padding: "5rem 0", borderBottom: "1px solid #262626", background: "#0A0A0A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>04</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {install.eyebrow.toLowerCase()}
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "3rem",
              color: "#FAFAFA",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {install.headline}
          </h2>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #262626",
                    background: "#000000",
                  }}
                >
                  <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid #262626", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "0.7rem", color: "#525252", fontFamily: "'JetBrains Mono', monospace" }}>{opt.label.toLowerCase()}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontSize: "0.75rem", color: "#525252", marginBottom: "0.75rem", fontFamily: "'Inter', system-ui, sans-serif" }}>{opt.description}</p>
                    <TerminalPrompt>{opt.code}</TerminalPrompt>
                    {opt.sub && (
                      <pre style={{ marginTop: "0.75rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", color: "#525252", lineHeight: 1.8 }}>
                        {opt.sub}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ border: "1px solid #262626", background: "#000000" }}>
              <div style={{ padding: "0.6rem 1rem", borderBottom: "1px solid #262626" }}>
                <span style={{ fontSize: "0.7rem", color: "#22C55E", fontFamily: "'JetBrains Mono', monospace" }}>// @heysummon/sdk</span>
              </div>
              <pre
                style={{
                  padding: "1.5rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.78rem",
                  color: "#A3A3A3",
                  lineHeight: 1.9,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {install.sdkSnippet}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* --- INTEGRATIONS --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #262626" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>05</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {integrations.eyebrow.toLowerCase()}
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "3rem",
              color: "#FAFAFA",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {integrations.headline}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0" style={{ border: "1px solid #262626" }}>
            {integrations.items.map((item, i) => (
              <div
                key={item.name}
                style={{
                  padding: "1.5rem",
                  borderRight: i < 3 ? "1px solid #262626" : "none",
                }}
              >
                <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.5rem", fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.name}
                </h3>
                <p style={{ fontSize: "0.78rem", color: "#737373", lineHeight: 1.7, marginBottom: "0.75rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {item.description}
                </p>
                <p style={{ fontSize: "0.7rem", color: "#22C55E", fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.setup}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- OPEN SOURCE --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #262626", background: "#0A0A0A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>06</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {openSource.eyebrow.toLowerCase()}
            </span>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2
                style={{
                  fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#FAFAFA",
                  marginBottom: "1.5rem",
                  fontFamily: "'Inter', system-ui, sans-serif",
                }}
              >
                {openSource.headline}
              </h2>
              <p style={{ color: "#737373", lineHeight: 1.8, marginBottom: "2rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                {openSource.body}
              </p>
              <a
                href={openSource.github}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  border: "1px solid #262626",
                  color: "#FAFAFA",
                  fontWeight: 600,
                  padding: "0.65rem 1.25rem",
                  fontSize: "0.8rem",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                className="hover:border-[#FAFAFA] transition-colors"
              >
                github.com/thomasansems/heysummon &rarr;
              </a>
            </div>

            <div className="grid grid-cols-2 gap-0" style={{ border: "1px solid #262626" }}>
              {openSource.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  style={{
                    padding: "1.5rem",
                    borderRight: i % 2 === 0 ? "1px solid #262626" : "none",
                    borderBottom: i < 2 ? "1px solid #262626" : "none",
                  }}
                >
                  <p style={{ fontSize: "0.65rem", color: "#525252", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace" }}>
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #262626" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>07</span>
            <div style={{ flex: 1, height: "1px", background: "#262626" }} />
            <span style={{ color: "#525252", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase" }}>
              {faq.eyebrow.toLowerCase()}
            </span>
          </div>

          <h2
            style={{
              fontSize: "clamp(1.5rem, 3vw, 2.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "3rem",
              color: "#FAFAFA",
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            {faq.headline}
          </h2>

          <dl>
            {faq.items.map((item, i) => (
              <div
                key={i}
                style={{
                  borderTop: "1px solid #262626",
                  padding: "1.75rem 0",
                  borderBottom: i === faq.items.length - 1 ? "1px solid #262626" : "none",
                }}
              >
                <dt style={{ fontSize: "0.9rem", fontWeight: 700, color: "#FAFAFA", marginBottom: "0.75rem", display: "flex", gap: "1rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  <span style={{ color: "#525252", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.7rem", flexShrink: 0, paddingTop: "0.15rem" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.question}
                </dt>
                <dd style={{ fontSize: "0.85rem", color: "#737373", lineHeight: 1.85, paddingLeft: "2.5rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- CTA --- */}
      <section style={{ padding: "6rem 0", position: "relative", overflow: "hidden" }}>
        {/* Grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "linear-gradient(#26262640 1px, transparent 1px), linear-gradient(90deg, #26262640 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Center glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{
            width: "400px",
            height: "300px",
            background: "radial-gradient(ellipse, rgba(255,107,74,0.1) 0%, rgba(74,143,231,0.05) 50%, transparent 70%)",
          }}
        />

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2
            style={{
              fontSize: "clamp(2.5rem, 5vw, 4rem)",
              fontWeight: 900,
              letterSpacing: "-0.04em",
              marginBottom: "1rem",
              fontFamily: "'Inter', system-ui, sans-serif",
              background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {cta.headline}
          </h2>
          <p style={{ color: "#737373", fontSize: "1rem", marginBottom: "3rem", fontFamily: "'Inter', system-ui, sans-serif" }}>
            {cta.subheadline}
          </p>

          {/* Terminal CTA */}
          <div
            style={{
              display: "inline-block",
              border: "1px solid #262626",
              background: "#0A0A0A",
              textAlign: "left",
              minWidth: "320px",
            }}
          >
            <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #262626", display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FF6B4A" }} />
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#FFD166" }} />
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E" }} />
            </div>
            <div style={{ padding: "1.25rem" }}>
              <a href={cta.primary.href} className="block hover:opacity-80 transition-opacity">
                <TerminalPrompt>{cta.primary.label}</TerminalPrompt>
              </a>
            </div>
          </div>

          <div className="flex justify-center gap-6 mt-6">
            <a
              href={cta.secondary.href}
              style={{ color: "#737373", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace" }}
              className="hover:text-[#FAFAFA] transition-colors"
            >
              {cta.secondary.label.toLowerCase()} &rarr;
            </a>
            <a
              href={cta.tertiary.href}
              style={{ color: "#525252", fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace" }}
              className="hover:text-[#737373] transition-colors"
            >
              {cta.tertiary.label.toLowerCase()} &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <GradientBar />
      <footer style={{ background: "#000000", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p
                style={{
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  marginBottom: "0.25rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                heysummon
              </p>
              <p style={{ color: "#525252", fontSize: "0.75rem" }}>{footer.tagline.toLowerCase()}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href}
                  style={{ color: "#525252", fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace" }}
                  className="hover:text-[#737373] transition-colors">
                  {link.label.toLowerCase()}
                </a>
              ))}
            </nav>
          </div>
          <div style={{ borderTop: "1px solid #262626", marginTop: "2rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#262626", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>{footer.copyright}</p>
            <p style={{ color: "#262626", fontSize: "0.7rem", fontFamily: "'JetBrains Mono', monospace" }}>{footer.license.toLowerCase()}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
