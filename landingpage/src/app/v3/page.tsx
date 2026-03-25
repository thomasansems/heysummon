// V3: THE GATEWAY
// Modern SaaS with Japanese accents. Brand gradient (coral -> blue).
// Clean white background, subtle shadows, rounded cards.
// Most "conventional" SaaS landing page — professional, trustworthy.
//
// Design tokens — change here to restyle V3:
// --v3-bg:       #FFFFFF  (white base)
// --v3-surface:  #F8FAFC  (light gray surface)
// --v3-border:   #E5E7EB  (gray border)
// --v3-text:     #111827  (near-black text)
// --v3-muted:    #6B7280  (muted gray)
// --v3-coral:    #FF6B4A  (brand coral)
// --v3-blue:     #4A8FE7  (brand blue)
// --v3-gradient: linear-gradient(135deg, #FF6B4A, #4A8FE7)

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

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

export default function V3Gateway() {
  return (
    <div
      className="min-h-screen font-sans"
      style={{
        background: "#FFFFFF",
        color: "#111827",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* --- NAV --- */}
      <header
        style={{
          borderBottom: "1px solid #E5E7EB",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
        }}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a
            href="/"
            style={{
              fontWeight: 800,
              fontSize: "1.15rem",
              letterSpacing: "-0.02em",
              background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            HeySummon
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href} style={{ color: "#6B7280", fontSize: "0.875rem" }}
                className="hover:text-[#111827] transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={nav.cta.href}
            style={{
              background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
              color: "#FFFFFF",
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

      {/* --- HERO --- */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "90vh", display: "flex", alignItems: "center" }}
      >
        {/* Subtle gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at 70% 20%, rgba(255,107,74,0.06) 0%, transparent 60%), radial-gradient(ellipse at 30% 80%, rgba(74,143,231,0.06) 0%, transparent 60%)",
          }}
        />

        {/* Subtle wave pattern */}
        <div className="absolute bottom-0 left-0 right-0 opacity-30 pointer-events-none">
          <Wave variant="simple" color="#E5E7EB" rows={4} className="w-full h-20" />
        </div>

        <div className="max-w-6xl mx-auto px-6 py-20 w-full relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: copy */}
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "linear-gradient(135deg, rgba(255,107,74,0.1), rgba(74,143,231,0.1))",
                  border: "1px solid rgba(255,107,74,0.2)",
                  borderRadius: "2rem",
                  padding: "0.35rem 1rem",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#FF6B4A",
                  marginBottom: "2rem",
                }}
              >
                {hero.badge}
              </div>

              <h1
                style={{
                  fontSize: "clamp(2.5rem, 5vw, 4rem)",
                  fontWeight: 900,
                  lineHeight: 1.05,
                  letterSpacing: "-0.03em",
                  color: "#111827",
                  marginBottom: "1.5rem",
                }}
              >
                {hero.headline}
              </h1>

              <p
                style={{
                  fontSize: "1.125rem",
                  lineHeight: 1.7,
                  color: "#6B7280",
                  maxWidth: "480px",
                  marginBottom: "2.5rem",
                }}
              >
                {hero.subheadline}
              </p>

              <div className="flex flex-wrap gap-4 mb-6">
                <a
                  href={hero.ctas[0].href}
                  style={{
                    background: "linear-gradient(135deg, #FF6B4A, #E85D3A)",
                    color: "#FFFFFF",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    padding: "0.85rem 1.75rem",
                    borderRadius: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "0 4px 14px rgba(255,107,74,0.3)",
                  }}
                  className="hover:opacity-90 transition-opacity"
                >
                  <span style={{ opacity: 0.6 }}>$</span> {hero.ctas[0].label}
                </a>
                <a
                  href={hero.ctas[1].href}
                  style={{
                    border: "1px solid #E5E7EB",
                    color: "#374151",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    padding: "0.85rem 1.75rem",
                    borderRadius: "0.5rem",
                    background: "#FFFFFF",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  }}
                  className="hover:border-[#D1D5DB] hover:shadow-md transition-all"
                >
                  {hero.ctas[1].label} &rarr;
                </a>
              </div>
            </div>

            {/* Right: sumo image with gradient border */}
            <div className="flex justify-center lg:justify-end">
              <div
                style={{
                  position: "relative",
                  borderRadius: "1rem",
                  padding: "3px",
                  background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                  boxShadow: "0 8px 30px rgba(255,107,74,0.15), 0 4px 16px rgba(74,143,231,0.1)",
                }}
              >
                <img
                  src="/sumo-hero.jpeg"
                  alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
                  style={{
                    display: "block",
                    borderRadius: "0.85rem",
                    width: "100%",
                    maxWidth: "480px",
                    height: "auto",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM --- */}
      <section style={{ background: "#F8FAFC", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-4xl mx-auto px-6">
          <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            {problem.eyebrow}
          </p>
          <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "2rem", color: "#111827" }}>
            {problem.headline}
          </h2>

          <blockquote
            style={{
              background: "#FFFFFF",
              borderLeft: "4px solid #FF6B4A",
              padding: "1.25rem 1.75rem",
              borderRadius: "0 0.75rem 0.75rem 0",
              marginBottom: "2.5rem",
              color: "#374151",
              fontStyle: "italic",
              fontSize: "1.05rem",
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}
          >
            {problem.callout}
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ color: "#6B7280", lineHeight: 1.8, fontSize: "1rem" }}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section style={{ background: "#FFFFFF", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {howItWorks.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#111827" }}>
              {howItWorks.headline}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.steps.map((step, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* Connector line */}
                {i < howItWorks.steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-10 left-full"
                    style={{ height: "2px", background: "linear-gradient(90deg, #FF6B4A, #4A8FE7)", width: "calc(100% - 3rem)", marginLeft: "1.5rem", opacity: 0.3 }}
                  />
                )}

                <div
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "1rem",
                    padding: "2rem",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <div
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                      borderRadius: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFFFFF",
                      fontWeight: 800,
                      fontSize: "0.875rem",
                      fontFamily: "'JetBrains Mono', monospace",
                      marginBottom: "1.25rem",
                    }}
                  >
                    {step.number}
                  </div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827", marginBottom: "0.75rem" }}>
                    {step.title}
                  </h3>
                  <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.7 }}>
                    {step.description}
                  </p>
                  {step.code && (
                    <pre
                      style={{
                        marginTop: "1rem",
                        background: "#1F2937",
                        borderRadius: "0.5rem",
                        padding: "0.875rem 1rem",
                        fontSize: "0.75rem",
                        color: "#E5E7EB",
                        fontFamily: "'JetBrains Mono', monospace",
                        overflow: "auto",
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.6,
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

      {/* --- FEATURES --- */}
      <section style={{ background: "#F8FAFC", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#111827" }}>
              Built for developers who ship AI agents.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feat) => (
              <div
                key={feat.id}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "1rem",
                  padding: "2rem",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div
                  style={{
                    width: "2.75rem",
                    height: "2.75rem",
                    background: "linear-gradient(135deg, rgba(255,107,74,0.1), rgba(74,143,231,0.1))",
                    border: "1px solid rgba(255,107,74,0.15)",
                    borderRadius: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FF6B4A",
                    marginBottom: "1.25rem",
                  }}
                >
                  <Icon name={feat.icon} />
                </div>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111827", marginBottom: "0.6rem" }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: "0.875rem", color: "#6B7280", lineHeight: 1.7, marginBottom: "1rem" }}>
                  {feat.description}
                </p>
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "'JetBrains Mono', monospace",
                    background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontWeight: 500,
                  }}
                >
                  {feat.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INSTALL --- */}
      <section id="install" style={{ background: "#FFFFFF", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {install.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#111827" }}>
              {install.headline}
            </h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div
                  key={i}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: "0.75rem", background: "#F9FAFB" }}>
                    <div style={{ display: "flex", gap: "0.35rem" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FF6B4A" }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FFD166" }} />
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#4A8FE7" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "#6B7280", fontFamily: "'JetBrains Mono', monospace" }}>{opt.label}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.875rem", color: "#111827", fontWeight: 600 }}>
                      <span style={{ color: "#FF6B4A" }}>$</span> {opt.code}
                    </pre>
                    {opt.sub && (
                      <pre style={{ marginTop: "0.5rem", fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "#9CA3AF", lineHeight: 1.8 }}>
                        {opt.sub}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                background: "#1F2937",
                borderRadius: "0.75rem",
                overflow: "hidden",
                boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              }}
            >
              <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#9CA3AF", fontFamily: "'JetBrains Mono', monospace" }}>@heysummon/sdk</span>
              </div>
              <pre
                style={{
                  padding: "1.5rem",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.8rem",
                  color: "#D1D5DB",
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

      {/* --- INTEGRATIONS --- */}
      <section style={{ background: "#F8FAFC", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-10">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {integrations.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#111827" }}>
              {integrations.headline}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.items.map((item) => (
              <div
                key={item.name}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#111827", marginBottom: "0.5rem" }}>
                  {item.name}
                </h3>
                <p style={{ fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.7, marginBottom: "0.75rem" }}>
                  {item.description}
                </p>
                <p style={{ fontSize: "0.75rem", color: "#FF6B4A", fontFamily: "'JetBrains Mono', monospace" }}>
                  {item.setup}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- OPEN SOURCE --- */}
      <section style={{ background: "#FFFFFF", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
                {openSource.eyebrow}
              </p>
              <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#111827", marginBottom: "1.5rem" }}>
                {openSource.headline}
              </h2>
              <p style={{ color: "#6B7280", lineHeight: 1.8, marginBottom: "2rem" }}>
                {openSource.body}
              </p>
              <a
                href={openSource.github}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "#111827",
                  color: "#FFFFFF",
                  fontWeight: 700,
                  padding: "0.75rem 1.5rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                }}
                className="hover:bg-[#1F2937] transition-colors"
              >
                View on GitHub &rarr;
              </a>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {openSource.stats.map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E5E7EB",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                  }}
                >
                  <p style={{ fontSize: "0.75rem", color: "#9CA3AF", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {stat.label}
                  </p>
                  <p
                    style={{
                      fontSize: "1rem",
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
      <section style={{ background: "#F8FAFC", padding: "5rem 0", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="mb-12 text-center">
            <p style={{ color: "#FF6B4A", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              {faq.eyebrow}
            </p>
            <h2 style={{ fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "#111827" }}>
              {faq.headline}
            </h2>
          </div>

          <dl className="space-y-4">
            {faq.items.map((item, i) => (
              <div
                key={i}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}
              >
                <dt style={{ fontSize: "0.95rem", fontWeight: 700, color: "#111827", marginBottom: "0.75rem" }}>
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

      {/* --- CTA --- */}
      <section
        style={{
          background: "linear-gradient(135deg, #FF6B4A 0%, #4A8FE7 100%)",
          padding: "6rem 0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Subtle wave at bottom */}
        <div className="absolute bottom-0 left-0 right-0 opacity-20 pointer-events-none">
          <Wave variant="fill" color="#FFFFFF" opacity={0.5} className="w-full h-16" />
        </div>

        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, letterSpacing: "-0.03em", color: "#FFFFFF", marginBottom: "1rem" }}>
            {cta.headline}
          </h2>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "1.05rem", marginBottom: "2.5rem" }}>
            {cta.subheadline}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <a
              href={cta.primary.href}
              style={{
                background: "#FFFFFF",
                color: "#FF6B4A",
                fontWeight: 700,
                padding: "0.875rem 2rem",
                borderRadius: "0.5rem",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.9rem",
                boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
              }}
              className="hover:opacity-90 transition-opacity"
            >
              $ {cta.primary.label}
            </a>
            <a
              href={cta.secondary.href}
              style={{
                border: "2px solid rgba(255,255,255,0.5)",
                color: "#FFFFFF",
                fontWeight: 600,
                padding: "0.875rem 2rem",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
              className="hover:border-white transition-colors"
            >
              {cta.secondary.label} &rarr;
            </a>
          </div>
          <a href={cta.tertiary.href} style={{ display: "block", marginTop: "1.5rem", color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}
            className="hover:text-white transition-colors">
            {cta.tertiary.label}
          </a>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ background: "#FFFFFF", borderTop: "1px solid #E5E7EB", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  marginBottom: "0.25rem",
                  background: "linear-gradient(135deg, #FF6B4A, #4A8FE7)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                HeySummon
              </p>
              <p style={{ color: "#9CA3AF", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ color: "#9CA3AF", fontSize: "0.8rem" }}
                  className="hover:text-[#111827] transition-colors">
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
          <div style={{ borderTop: "1px solid #E5E7EB", marginTop: "2rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#D1D5DB", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#D1D5DB", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
