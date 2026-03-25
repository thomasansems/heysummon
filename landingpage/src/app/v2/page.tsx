// V2: THE SCROLL
// Warm cream / washi-paper background. Vermillion + navy palette.
// Editorial numbered sections. Traditional woodblock print aesthetic.
//
// Design tokens — change here to restyle V2:
// --v2-bg:       #F5F0E8  (washi paper cream)
// --v2-surface:  #EDE8DF  (slightly darker surface)
// --v2-border:   #D4CFC6  (warm border)
// --v2-red:      #C1121F  (vermillion red)
// --v2-navy:     #1B2A4A  (deep navy)
// --v2-gold:     #D4A017  (antique gold)
// --v2-brown:    #2A1F14  (dark brown text)
// --v2-muted:    #7A6F65  (muted warm gray)

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

function RedRule() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", margin: "2.5rem 0" }}>
      <div style={{ width: "3rem", height: "3px", background: "#C1121F" }} />
      <div style={{ flex: 1, height: "1px", background: "#D4CFC6" }} />
    </div>
  );
}

function SectionNumber({ n }: { n: string }) {
  return (
    <span
      style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "0.7rem",
        fontWeight: 600,
        color: "#C1121F",
        letterSpacing: "0.1em",
        display: "block",
        marginBottom: "0.75rem",
      }}
    >
      {n}
    </span>
  );
}

export default function V2Scroll() {
  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background: "#F5F0E8",
        color: "#2A1F14",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ─── NAV ─────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "2px solid #2A1F14",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(245,240,232,0.95)",
          backdropFilter: "blur(8px)",
        }}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ color: "#2A1F14", fontWeight: 900, fontSize: "1.1rem", letterSpacing: "-0.02em" }}>
            HeySummon
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href}
                style={{ color: "#7A6F65", fontSize: "0.875rem" }}
                className="hover:text-[#2A1F14] transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={nav.cta.href}
            style={{
              background: "#C1121F",
              color: "#F5F0E8",
              fontWeight: 700,
              fontSize: "0.875rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.35rem",
            }}
            className="hover:opacity-90 transition-opacity"
          >
            {nav.cta.label} →
          </a>
        </nav>
      </header>

      {/* ─── HERO ────────────────────────────────────────── */}
      <section style={{ borderBottom: "2px solid #2A1F14", padding: "4rem 0 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Text content */}
          <div style={{ maxWidth: "640px", marginBottom: "3rem" }}>
            <p
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#C1121F",
                marginBottom: "1.5rem",
              }}
            >
              {hero.eyebrow}
            </p>

            <h1
              style={{
                fontSize: "clamp(2.75rem, 5vw, 4.5rem)",
                fontWeight: 900,
                lineHeight: 1.0,
                letterSpacing: "-0.035em",
                color: "#2A1F14",
                marginBottom: "1.75rem",
              }}
            >
              {hero.headline}
            </h1>

            <p
              style={{
                fontSize: "1.1rem",
                lineHeight: 1.7,
                color: "#7A6F65",
                maxWidth: "520px",
                marginBottom: "2.5rem",
              }}
            >
              {hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-4 mb-6">
              <a
                href={hero.ctas[0].href}
                style={{
                  background: "#1B2A4A",
                  color: "#F5F0E8",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.35rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
                className="hover:opacity-90 transition-opacity"
              >
                <span style={{ color: "#C1121F" }}>$</span> {hero.ctas[0].label}
              </a>
              <a
                href={hero.ctas[1].href}
                style={{
                  border: "2px solid #2A1F14",
                  color: "#2A1F14",
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.35rem",
                }}
                className="hover:bg-[#2A1F14] hover:text-[#F5F0E8] transition-all"
              >
                {hero.ctas[1].label} &rarr;
              </a>
            </div>

            <p style={{ fontSize: "0.75rem", color: "#B0A898" }}>{hero.badge}</p>
          </div>

          {/* Framed woodblock image — like a traditional print on display */}
          <div
            style={{
              border: "3px solid #2A1F14",
              background: "#2A1F14",
              padding: "6px",
              boxShadow: "0 8px 30px rgba(42,31,20,0.2)",
            }}
          >
            <div style={{ border: "1px solid #D4CFC6", overflow: "hidden" }}>
              <img
                src="/sumo-hero.jpeg"
                alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "420px",
                  objectFit: "cover",
                  objectPosition: "center 30%",
                  display: "block",
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── PROBLEM ─────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-4xl mx-auto px-6">
          <SectionNumber n="01 — THE PROBLEM" />
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "2rem" }}>
            {problem.headline}
          </h2>

          <blockquote
            style={{
              background: "#EDE8DF",
              borderLeft: "4px solid #C1121F",
              padding: "1.25rem 1.75rem",
              borderRadius: "0 0.5rem 0.5rem 0",
              marginBottom: "2.5rem",
              color: "#2A1F14",
              fontStyle: "italic",
              fontSize: "1.05rem",
              fontWeight: 500,
            }}
          >
            {problem.callout}
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ color: "#7A6F65", lineHeight: 1.85, fontSize: "1rem" }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6", background: "#EDE8DF" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionNumber n="02 — HOW IT WORKS" />
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "3rem" }}>
            {howItWorks.headline}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.steps.map((step, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: "3rem",
                    fontWeight: 900,
                    color: "#C1121F",
                    opacity: 0.15,
                    lineHeight: 1,
                    fontFamily: "'JetBrains Mono', monospace",
                    marginBottom: "0.5rem",
                  }}
                >
                  {step.number}
                </div>
                <div style={{ borderTop: "2px solid #C1121F", paddingTop: "1.25rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#2A1F14", marginBottom: "0.75rem" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "#7A6F65", lineHeight: 1.75 }}>
                    {step.description}
                  </p>
                  {step.code && (
                    <pre
                      style={{
                        marginTop: "1rem",
                        background: "#1B2A4A",
                        borderRadius: "0.5rem",
                        padding: "0.875rem 1rem",
                        fontSize: "0.73rem",
                        color: "#F5F0E8",
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionNumber n="03 — FEATURES" />
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "3rem" }}>
            What makes HeySummon different.
          </h2>

          <div className="grid md:grid-cols-2 gap-0" style={{ border: "1px solid #D4CFC6", borderRadius: "0.75rem", overflow: "hidden" }}>
            {features.map((feat, i) => (
              <div
                key={feat.id}
                style={{
                  padding: "2rem",
                  borderRight: i % 2 === 0 ? "1px solid #D4CFC6" : "none",
                  borderBottom: i < 2 ? "1px solid #D4CFC6" : "none",
                  background: i % 2 === 1 ? "#EDE8DF" : "#F5F0E8",
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#C1121F",
                    background: "rgba(193,18,31,0.08)",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "0.25rem",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    marginBottom: "1rem",
                  }}
                >
                  {feat.detail}
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#2A1F14", marginBottom: "0.6rem" }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#7A6F65", lineHeight: 1.75 }}>
                  {feat.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INSTALL ─────────────────────────────────────── */}
      <section id="install" style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6", background: "#EDE8DF" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionNumber n="04 — INSTALL" />
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "2.5rem" }}>
            {install.headline}
          </h2>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div
                  key={i}
                  style={{
                    background: "#F5F0E8",
                    border: "1px solid #D4CFC6",
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      background: "#1B2A4A",
                      padding: "0.75rem 1.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "#F5F0E8", opacity: 0.6, fontFamily: "'JetBrains Mono', monospace" }}>
                      {opt.label}
                    </span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "#7A6F65", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.875rem", color: "#1B2A4A", fontWeight: 600 }}>
                      <span style={{ color: "#C1121F" }}>$ </span>{opt.code}
                    </pre>
                    {opt.sub && (
                      <pre style={{ marginTop: "0.5rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#B0A898", lineHeight: 1.8 }}>
                        {opt.sub}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#1B2A4A",
                borderRadius: "0.5rem",
                overflow: "hidden",
                border: "1px solid #0F1A2E",
              }}
            >
              <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace" }}>@heysummon/sdk</span>
              </div>
              <pre
                style={{
                  padding: "1.5rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.78rem",
                  color: "#C5D1DF",
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

      {/* ─── INTEGRATIONS ────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionNumber n="05 — INTEGRATIONS" />
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "3rem" }}>
            {integrations.headline}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.items.map((item, i) => (
              <div
                key={item.name}
                style={{
                  borderTop: "3px solid #C1121F",
                  paddingTop: "1.25rem",
                }}
              >
                <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "#2A1F14", marginBottom: "0.5rem" }}>
                  {item.name}
                </h3>
                <p style={{ fontSize: "0.8rem", color: "#7A6F65", lineHeight: 1.7, marginBottom: "0.75rem" }}>
                  {item.description}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#1B2A4A", fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.setup}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── OPEN SOURCE ─────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6", background: "#EDE8DF" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionNumber n="06 — OPEN SOURCE" />

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "1.5rem" }}>
                {openSource.headline}
              </h2>
              <p style={{ color: "#7A6F65", lineHeight: 1.85, marginBottom: "2rem" }}>
                {openSource.body}
              </p>
              <a
                href={openSource.github}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "#2A1F14",
                  color: "#F5F0E8",
                  fontWeight: 700,
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.35rem",
                  fontSize: "0.875rem",
                }}
                className="hover:opacity-90 transition-opacity"
              >
                View on GitHub →
              </a>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {openSource.stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "#F5F0E8",
                    border: "1px solid #D4CFC6",
                    borderRadius: "0.5rem",
                    padding: "1.25rem",
                    borderTop: "3px solid #C1121F",
                  }}
                >
                  <p style={{ fontSize: "0.7rem", color: "#B0A898", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2A1F14" }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────── */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-3xl mx-auto px-6">
          <SectionNumber n="07 — FAQ" />
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.025em", color: "#2A1F14", marginBottom: "3rem" }}>
            {faq.headline}
          </h2>

          <dl className="space-y-0">
            {faq.items.map((item, i) => (
              <div
                key={i}
                style={{
                  borderTop: "1px solid #D4CFC6",
                  padding: "1.75rem 0",
                  borderBottom: i === faq.items.length - 1 ? "1px solid #D4CFC6" : "none",
                }}
              >
                <dt style={{ fontSize: "0.95rem", fontWeight: 700, color: "#2A1F14", marginBottom: "0.75rem", display: "flex", gap: "1rem" }}>
                  <span style={{ color: "#C1121F", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", paddingTop: "0.1rem", flexShrink: 0 }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {item.question}
                </dt>
                <dd style={{ fontSize: "0.875rem", color: "#7A6F65", lineHeight: 1.85, paddingLeft: "2.5rem" }}>
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ─── CTA ─────────────────────────────────────────── */}
      <section
        style={{
          background: "#1B2A4A",
          padding: "6rem 0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ukiyo-e wave decoration */}
        <div className="absolute bottom-0 left-0 right-0 opacity-20">
          <Wave variant="fill" color="#F5F0E8" opacity={0.4} className="w-full h-20" />
        </div>

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <p style={{ color: "#C1121F", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1rem" }}>
            Ready
          </p>
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#F5F0E8", marginBottom: "1rem" }}>
            {cta.headline}
          </h2>
          <p style={{ color: "#9CA3AF", fontSize: "1.05rem", marginBottom: "2.5rem" }}>
            {cta.subheadline}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={cta.primary.href}
              style={{
                background: "#F5F0E8",
                color: "#1B2A4A",
                fontWeight: 700,
                padding: "0.875rem 2rem",
                borderRadius: "0.35rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.9rem",
              }}
              className="hover:opacity-90 transition-opacity"
            >
              $ {cta.primary.label}
            </a>
            <a
              href={cta.secondary.href}
              style={{
                border: "1px solid rgba(245,240,232,0.3)",
                color: "#F5F0E8",
                fontWeight: 600,
                padding: "0.875rem 2rem",
                borderRadius: "0.35rem",
                fontSize: "0.875rem",
              }}
              className="hover:border-[rgba(245,240,232,0.6)] transition-colors"
            >
              {cta.secondary.label} →
            </a>
          </div>
          <a href={cta.tertiary.href} style={{ display: "block", marginTop: "1.5rem", color: "#6B7280", fontSize: "0.85rem" }}
            className="hover:text-[#9CA3AF] transition-colors">
            {cta.tertiary.label}
          </a>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────── */}
      <footer style={{ background: "#F5F0E8", borderTop: "2px solid #2A1F14", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p style={{ color: "#2A1F14", fontWeight: 900, fontSize: "1rem", marginBottom: "0.25rem" }}>HeySummon</p>
              <p style={{ color: "#B0A898", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ color: "#B0A898", fontSize: "0.8rem" }}
                  className="hover:text-[#2A1F14] transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <RedRule />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
