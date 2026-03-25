// V1: THE DOJO
// Dark, dramatic, Neo-Ukiyo-e poster aesthetic
// Coral on near-black. Wave patterns. Bold sumo presence.
//
// Design tokens — change here to restyle everything in V1:
// --v1-bg:      #0A0A14  (base dark background)
// --v1-surface: #10101E  (slightly lighter surface)
// --v1-border:  #1E1E30  (subtle borders)
// --v1-coral:   #FF6B4A  (primary accent, coral/orange)
// --v1-blue:    #4A8FE7  (secondary accent, brand blue)
// --v1-cream:   #F0EAE0  (body text, warm cream)
// --v1-muted:   #6B7280  (muted text)
// --v1-gold:    #FFD166  (highlight accent)

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

// Icon map — simple inline SVGs, no icon library dependency
function Icon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    lock: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    ),
    server: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v.75a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25v-.75m0-10.5v-.75A2.25 2.25 0 014.5 4h15a2.25 2.25 0 012.25 2.25v.75m0 10.5v-10.5M3 6.75h18M3 17.25h18" />
    ),
    plug: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    ),
    code: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    ),
  };
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
      {icons[name] ?? null}
    </svg>
  );
}

export default function V1Dojo() {
  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background: "#0A0A14",
        color: "#F0EAE0",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* ─── NAV ─────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid #1E1E30",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(10,10,20,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ color: "#FF6B4A", fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.02em" }}>
            HeySummon
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href} style={{ color: "#9CA3AF", fontSize: "0.875rem" }}
                className="hover:text-white transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={nav.cta.href}
            style={{
              background: "#FF6B4A",
              color: "#0A0A14",
              fontWeight: 700,
              fontSize: "0.875rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.5rem",
            }}
            className="hover:opacity-90 transition-opacity"
          >
            {nav.cta.label}
          </a>
        </nav>
      </header>

      {/* ─── HERO ────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Full hero image as background */}
        <div className="absolute inset-0">
          <img
            src="/sumo-hero.jpeg"
            alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 30%",
            }}
          />
          {/* Dark gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, rgba(10,10,20,0.55) 0%, rgba(10,10,20,0.3) 40%, rgba(10,10,20,0.75) 70%, #0A0A14 100%)",
            }}
          />
        </div>

        {/* Hero content over image */}
        <div className="relative z-10 flex-1 flex items-end">
          <div className="max-w-6xl mx-auto px-6 pb-20 pt-40 w-full">
            <p
              style={{
                color: "#FF6B4A",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "1.5rem",
              }}
            >
              {hero.eyebrow}
            </p>
            <h1
              style={{
                fontSize: "clamp(2.5rem, 5vw, 4rem)",
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "#F0EAE0",
                marginBottom: "1.5rem",
                maxWidth: "600px",
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}
            >
              {hero.headline}
            </h1>
            <p
              style={{
                fontSize: "1.125rem",
                lineHeight: 1.7,
                color: "#D1D5DB",
                maxWidth: "480px",
                marginBottom: "2.5rem",
                textShadow: "0 1px 8px rgba(0,0,0,0.5)",
              }}
            >
              {hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-4 mb-8">
              <a
                href={hero.ctas[0].href}
                style={{
                  background: "#FF6B4A",
                  color: "#0A0A14",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 20px rgba(255,107,74,0.4)",
                }}
                className="hover:opacity-90 transition-all"
              >
                <span style={{ opacity: 0.5 }}>$</span> {hero.ctas[0].label}
              </a>
              <a
                href={hero.ctas[1].href}
                style={{
                  background: "rgba(10,10,20,0.6)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(240,234,224,0.25)",
                  color: "#F0EAE0",
                  fontSize: "0.875rem",
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.5rem",
                }}
                className="hover:border-[rgba(240,234,224,0.5)] transition-all"
              >
                {hero.ctas[1].label} &rarr;
              </a>
            </div>

            <p style={{ fontSize: "0.75rem", color: "#6B7280" }}>{hero.badge}</p>
          </div>
        </div>
      </section>

      {/* ─── PROBLEM ─────────────────────────────────────── */}
      <section style={{ background: "#10101E", padding: "5rem 0" }}>
        <div className="max-w-4xl mx-auto px-6">
          <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            {problem.eyebrow}
          </p>
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "2rem", color: "#F0EAE0" }}>
            {problem.headline}
          </h2>

          <blockquote
            style={{
              borderLeft: "3px solid #FF6B4A",
              paddingLeft: "1.5rem",
              marginBottom: "2.5rem",
              color: "#9CA3AF",
              fontStyle: "italic",
              fontSize: "1.05rem",
            }}
          >
            {problem.callout}
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ color: "#9CA3AF", lineHeight: 1.8, fontSize: "1rem" }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────── */}
      <section style={{ background: "#0A0A14", padding: "5rem 0", borderTop: "1px solid #1E1E30" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {howItWorks.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#F0EAE0" }}>
              {howItWorks.headline}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.steps.map((step, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Connector line */}
                {i < howItWorks.steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-8 left-full w-full"
                    style={{ height: "1px", background: "linear-gradient(90deg, #FF6B4A40, transparent)", width: "calc(100% - 2rem)", marginLeft: "1rem" }}
                  />
                )}

                <div
                  style={{
                    background: "#10101E",
                    border: "1px solid #1E1E30",
                    borderRadius: "0.75rem",
                    padding: "1.75rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "0.75rem",
                      color: "#FF6B4A",
                      background: "rgba(255,107,74,0.1)",
                      border: "1px solid rgba(255,107,74,0.3)",
                      padding: "0.25rem 0.6rem",
                      borderRadius: "0.35rem",
                      marginBottom: "1rem",
                    }}
                  >
                    {step.number}
                  </span>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F0EAE0", marginBottom: "0.75rem" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.7 }}>
                    {step.description}
                  </p>
                  {step.code && (
                    <pre
                      style={{
                        marginTop: "1rem",
                        background: "#050508",
                        border: "1px solid #1E1E30",
                        borderRadius: "0.5rem",
                        padding: "0.75rem 1rem",
                        fontSize: "0.75rem",
                        color: "#4A8FE7",
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
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
      <section style={{ background: "#10101E", padding: "5rem 0", borderTop: "1px solid #1E1E30" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feat) => (
              <div
                key={feat.id}
                style={{
                  background: "#0A0A14",
                  border: "1px solid #1E1E30",
                  borderRadius: "0.75rem",
                  padding: "1.75rem",
                }}
              >
                <div
                  style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    background: "rgba(255,107,74,0.1)",
                    border: "1px solid rgba(255,107,74,0.25)",
                    borderRadius: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FF6B4A",
                    marginBottom: "1rem",
                  }}
                >
                  <Icon name={feat.icon} />
                </div>
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#F0EAE0", marginBottom: "0.5rem" }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.7, marginBottom: "1rem" }}>
                  {feat.description}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#FF6B4A", fontFamily: "'JetBrains Mono', monospace" }}>
                  {feat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INSTALL ─────────────────────────────────────── */}
      <section id="install" style={{ background: "#0A0A14", padding: "5rem 0", borderTop: "1px solid #1E1E30" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {install.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#F0EAE0" }}>
              {install.headline}
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Install options */}
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div
                  key={i}
                  style={{
                    background: "#10101E",
                    border: "1px solid #1E1E30",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #1E1E30", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FF6B4A", opacity: 0.7 }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FFD166", opacity: 0.7 }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#4A8FE7", opacity: 0.7 }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>{opt.label}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.875rem", color: "#FF6B4A" }}>
                      <span style={{ color: "#4A8FE7" }}>$</span> {opt.code}
                    </pre>
                    {opt.sub && (
                      <pre style={{ marginTop: "0.75rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#4B5563", lineHeight: 1.8 }}>
                        {opt.sub}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* SDK snippet */}
            <div
              style={{
                background: "#050508",
                border: "1px solid #1E1E30",
                borderRadius: "0.75rem",
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #1E1E30", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#4A8FE7", fontFamily: "'JetBrains Mono', monospace" }}>@heysummon/sdk</span>
              </div>
              <pre
                style={{
                  padding: "1.5rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.8rem",
                  color: "#9CA3AF",
                  lineHeight: 1.8,
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
      <section style={{ background: "#10101E", padding: "5rem 0", borderTop: "1px solid #1E1E30" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {integrations.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#F0EAE0" }}>
              {integrations.headline}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.items.map((item) => (
              <div
                key={item.name}
                style={{
                  background: "#0A0A14",
                  border: "1px solid #1E1E30",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                }}
              >
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#F0EAE0", marginBottom: "0.5rem" }}>
                  {item.name}
                </h3>
                <p style={{ fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.6, marginBottom: "0.75rem" }}>
                  {item.description}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#4A8FE7", fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.setup}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── OPEN SOURCE ─────────────────────────────────── */}
      <section style={{ background: "#0A0A14", padding: "5rem 0", borderTop: "1px solid #1E1E30" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
                {openSource.eyebrow}
              </p>
              <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#F0EAE0", marginBottom: "1.5rem" }}>
                {openSource.headline}
              </h2>
              <p style={{ color: "#9CA3AF", lineHeight: 1.8, marginBottom: "2rem" }}>
                {openSource.body}
              </p>
              <a
                href={openSource.github}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  color: "#FF6B4A",
                  border: "1px solid rgba(255,107,74,0.4)",
                  padding: "0.6rem 1.25rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                }}
                className="hover:bg-[rgba(255,107,74,0.1)] transition-colors"
              >
                View on GitHub →
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {openSource.stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "#10101E",
                    border: "1px solid #1E1E30",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "#6B7280", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {stat.label}
                  </p>
                  <p style={{ fontSize: "1rem", fontWeight: 700, color: "#FF6B4A", fontFamily: "'JetBrains Mono', monospace" }}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────────── */}
      <section style={{ background: "#10101E", padding: "5rem 0", borderTop: "1px solid #1E1E30" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-10 text-center">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {faq.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#F0EAE0" }}>
              {faq.headline}
            </h2>
          </div>

          <dl className="space-y-4">
            {faq.items.map((item, i) => (
              <div
                key={i}
                style={{
                  background: "#0A0A14",
                  border: "1px solid #1E1E30",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                }}
              >
                <dt style={{ fontSize: "0.95rem", fontWeight: 700, color: "#F0EAE0", marginBottom: "0.75rem" }}>
                  {item.question}
                </dt>
                <dd style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.8 }}>
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
          background: "linear-gradient(135deg, rgba(255,107,74,0.15) 0%, rgba(74,143,231,0.15) 100%)",
          borderTop: "1px solid rgba(255,107,74,0.2)",
          padding: "6rem 0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="absolute inset-0 wave-pattern pointer-events-none" style={{ color: "#FF6B4A", opacity: 0.3 }} />
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#F0EAE0", marginBottom: "1rem" }}>
            {cta.headline}
          </h2>
          <p style={{ color: "#9CA3AF", fontSize: "1.05rem", marginBottom: "2.5rem" }}>
            {cta.subheadline}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={cta.primary.href}
              style={{
                background: "#FF6B4A",
                color: "#0A0A14",
                fontWeight: 700,
                padding: "0.875rem 2rem",
                borderRadius: "0.5rem",
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
                border: "1px solid #1E1E30",
                color: "#9CA3AF",
                fontWeight: 600,
                padding: "0.875rem 2rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
              className="hover:border-gray-500 hover:text-white transition-all"
            >
              {cta.secondary.label} →
            </a>
          </div>
          <a href={cta.tertiary.href} style={{ display: "block", marginTop: "1.5rem", color: "#4B5563", fontSize: "0.85rem" }}
            className="hover:text-gray-400 transition-colors">
            {cta.tertiary.label}
          </a>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────── */}
      <footer style={{ background: "#050508", borderTop: "1px solid #1E1E30", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p style={{ color: "#FF6B4A", fontWeight: 800, fontSize: "1rem", marginBottom: "0.25rem" }}>HeySummon</p>
              <p style={{ color: "#4B5563", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ color: "#4B5563", fontSize: "0.8rem" }}
                  className="hover:text-gray-400 transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div style={{ borderTop: "1px solid #1E1E30", marginTop: "2rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#374151", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#374151", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
