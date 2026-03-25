// V5: THE YOKOZUNA
// V2's editorial structure + full-screen hero image + Noto Serif JP headings.
// Colors from sumo artwork: navy, vermillion, gold, teal, cream.
// Japanese characters as section accents. Refined, classic.
//
// Palette from artwork:
// --v5-navy:    #1A1B3A  (sumo body)
// --v5-red:     #C1121F  (vermillion accents)
// --v5-gold:    #C8922A  (sun, belt highlights)
// --v5-teal:    #2D6B5A  (wave greens)
// --v5-cream:   #F5ECD7  (paper texture)
// --v5-dark:    #0F0F1E  (deep background)
// --v5-muted:   #8A8078  (warm muted text)

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

const SERIF = "'Noto Serif JP', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

function SectionLabel({ jp, en, n }: { jp: string; en: string; n: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2rem" }}>
      <span style={{ fontFamily: SERIF, fontSize: "1.1rem", color: "#C1121F", letterSpacing: "0.1em" }}>{jp}</span>
      <div style={{ flex: 1, height: "1px", background: "#D4CFC6" }} />
      <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#8A8078", textTransform: "uppercase" }}>{n} — {en}</span>
    </div>
  );
}

export default function V5Yokozuna() {
  return (
    <div className="min-h-screen" style={{ background: "#F5ECD7", color: "#1A1B3A" }}>
      {/* --- NAV --- */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: "rgba(245,236,215,0.9)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #D4CFC6",
        }}
      >
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "1.15rem", color: "#1A1B3A" }}>
            HeySummon <span style={{ fontFamily: SERIF, color: "#C1121F", fontSize: "0.8rem", marginLeft: "0.25rem" }}>召喚</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href} style={{ color: "#8A8078", fontSize: "0.85rem", fontFamily: SANS }}
                className="hover:text-[#1A1B3A] transition-colors">
                {link.label}
              </a>
            ))}
          </div>
          <a
            href={nav.cta.href}
            style={{
              background: "#C1121F",
              color: "#F5ECD7",
              fontWeight: 600,
              fontSize: "0.85rem",
              padding: "0.5rem 1.25rem",
              borderRadius: "0.35rem",
              fontFamily: SANS,
            }}
            className="hover:opacity-90 transition-opacity"
          >
            {nav.cta.label}
          </a>
        </nav>
      </header>

      {/* --- HERO: full-screen image --- */}
      <section className="relative" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="absolute inset-0">
          <img
            src="/sumo-hero.jpeg"
            alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 30%" }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to bottom, rgba(26,27,58,0.3) 0%, rgba(26,27,58,0.15) 40%, rgba(26,27,58,0.6) 75%, #F5ECD7 100%)",
            }}
          />
        </div>

        <div className="relative z-10 flex-1 flex items-end">
          <div className="max-w-6xl mx-auto px-6 pb-16 pt-40 w-full">
            <p style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "0.85rem", letterSpacing: "0.15em", marginBottom: "1.5rem", textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
              {hero.eyebrow}
            </p>
            <h1
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)",
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "#F5ECD7",
                marginBottom: "1.5rem",
                maxWidth: "650px",
                textShadow: "0 2px 20px rgba(0,0,0,0.5)",
              }}
            >
              {hero.headline}
            </h1>
            <p
              style={{
                fontFamily: SANS,
                fontSize: "1.1rem",
                lineHeight: 1.7,
                color: "#E8DFC8",
                maxWidth: "500px",
                marginBottom: "2.5rem",
                textShadow: "0 1px 8px rgba(0,0,0,0.4)",
              }}
            >
              {hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-4">
              <a
                href={hero.ctas[0].href}
                style={{
                  background: "#C1121F",
                  color: "#F5ECD7",
                  fontFamily: MONO,
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  padding: "0.8rem 1.75rem",
                  borderRadius: "0.35rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  boxShadow: "0 4px 16px rgba(193,18,31,0.4)",
                }}
                className="hover:opacity-90 transition-opacity"
              >
                <span style={{ opacity: 0.5 }}>$</span> {hero.ctas[0].label}
              </a>
              <a
                href={hero.ctas[1].href}
                style={{
                  background: "rgba(26,27,58,0.5)",
                  backdropFilter: "blur(8px)",
                  border: "1px solid rgba(245,236,215,0.3)",
                  color: "#F5ECD7",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  padding: "0.8rem 1.75rem",
                  borderRadius: "0.35rem",
                  fontFamily: SANS,
                }}
                className="hover:border-[rgba(245,236,215,0.6)] transition-all"
              >
                {hero.ctas[1].label} &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-4xl mx-auto px-6">
          <SectionLabel jp="問題" en="The Problem" n="01" />
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "2rem" }}>
            {problem.headline}
          </h2>

          <blockquote
            style={{
              background: "#EDE6D5",
              borderLeft: "4px solid #C1121F",
              padding: "1.25rem 1.75rem",
              borderRadius: "0 0.5rem 0.5rem 0",
              marginBottom: "2.5rem",
              fontFamily: SERIF,
              color: "#1A1B3A",
              fontStyle: "italic",
              fontSize: "1.05rem",
            }}
          >
            {problem.callout}
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ fontFamily: SANS, color: "#8A8078", lineHeight: 1.85, fontSize: "1rem" }}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6", background: "#EDE6D5" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel jp="仕組み" en="How It Works" n="02" />
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "3rem" }}>
            {howItWorks.headline}
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.steps.map((step, i) => (
              <div key={i}>
                <div style={{ fontSize: "2.5rem", fontWeight: 900, fontFamily: SERIF, color: "#C8922A", opacity: 0.3, lineHeight: 1, marginBottom: "0.5rem" }}>
                  {step.number}
                </div>
                <div style={{ borderTop: "3px solid #C1121F", paddingTop: "1.25rem" }}>
                  <h3 style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.75rem" }}>{step.title}</h3>
                  <p style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.75 }}>{step.description}</p>
                  {step.code && (
                    <pre style={{ marginTop: "1rem", background: "#1A1B3A", borderRadius: "0.5rem", padding: "0.875rem 1rem", fontSize: "0.73rem", color: "#F5ECD7", fontFamily: MONO, overflow: "auto", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
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
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel jp="特徴" en="Features" n="03" />
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "3rem" }}>
            What makes HeySummon different.
          </h2>

          <div className="grid md:grid-cols-2 gap-0" style={{ border: "1px solid #D4CFC6", borderRadius: "0.5rem", overflow: "hidden" }}>
            {features.map((feat, i) => (
              <div
                key={feat.id}
                style={{
                  padding: "2rem",
                  borderRight: i % 2 === 0 ? "1px solid #D4CFC6" : "none",
                  borderBottom: i < 2 ? "1px solid #D4CFC6" : "none",
                  background: i % 2 === 1 ? "#EDE6D5" : "#F5ECD7",
                }}
              >
                <div style={{ display: "inline-block", fontSize: "0.7rem", fontWeight: 700, color: "#C1121F", background: "rgba(193,18,31,0.08)", padding: "0.25rem 0.6rem", borderRadius: "0.25rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem", fontFamily: MONO }}>
                  {feat.detail}
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: "1.05rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.6rem" }}>{feat.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.75 }}>{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INSTALL --- */}
      <section id="install" style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6", background: "#EDE6D5" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel jp="導入" en="Install" n="04" />
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "2.5rem" }}>
            {install.headline}
          </h2>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div key={i} style={{ background: "#F5ECD7", border: "1px solid #D4CFC6", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <div style={{ background: "#1A1B3A", padding: "0.75rem 1.25rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "#F5ECD7", opacity: 0.6, fontFamily: MONO }}>{opt.label}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#8A8078", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: MONO, fontSize: "0.875rem", color: "#1A1B3A", fontWeight: 600 }}>
                      <span style={{ color: "#C1121F" }}>$ </span>{opt.code}
                    </pre>
                    {opt.sub && (
                      <pre style={{ marginTop: "0.5rem", fontFamily: MONO, fontSize: "0.75rem", color: "#B0A898", lineHeight: 1.8 }}>{opt.sub}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ background: "#1A1B3A", borderRadius: "0.5rem", overflow: "hidden" }}>
              <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(245,236,215,0.1)" }}>
                <span style={{ fontSize: "0.75rem", color: "#C8922A", fontFamily: MONO }}>@heysummon/sdk</span>
              </div>
              <pre style={{ padding: "1.5rem", fontFamily: MONO, fontSize: "0.78rem", color: "#D4CFC6", lineHeight: 1.9, overflow: "auto", whiteSpace: "pre-wrap" }}>
                {install.sdkSnippet}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* --- INTEGRATIONS --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel jp="連携" en="Integrations" n="05" />
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "3rem" }}>
            {integrations.headline}
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.items.map((item) => (
              <div key={item.name} style={{ borderTop: "3px solid #C8922A", paddingTop: "1.25rem" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.5rem" }}>{item.name}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#8A8078", lineHeight: 1.7, marginBottom: "0.75rem" }}>{item.description}</p>
                <p style={{ fontSize: "0.75rem", color: "#2D6B5A", fontFamily: MONO }}>{item.setup}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- OPEN SOURCE --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6", background: "#EDE6D5" }}>
        <div className="max-w-6xl mx-auto px-6">
          <SectionLabel jp="公開" en="Open Source" n="06" />
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "1.5rem" }}>{openSource.headline}</h2>
              <p style={{ fontFamily: SANS, color: "#8A8078", lineHeight: 1.85, marginBottom: "2rem" }}>{openSource.body}</p>
              <a href={openSource.github} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#1A1B3A", color: "#F5ECD7", fontWeight: 700, padding: "0.75rem 1.5rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:opacity-90 transition-opacity">
                View on GitHub &rarr;
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {openSource.stats.map((stat) => (
                <div key={stat.label} style={{ background: "#F5ECD7", border: "1px solid #D4CFC6", borderRadius: "0.5rem", padding: "1.25rem", borderTop: "3px solid #C1121F" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#B0A898", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</p>
                  <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, color: "#1A1B3A" }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-3xl mx-auto px-6">
          <SectionLabel jp="質問" en="FAQ" n="07" />
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "3rem" }}>{faq.headline}</h2>

          <dl>
            {faq.items.map((item, i) => (
              <div key={i} style={{ borderTop: "1px solid #D4CFC6", padding: "1.75rem 0", borderBottom: i === faq.items.length - 1 ? "1px solid #D4CFC6" : "none" }}>
                <dt style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.75rem", display: "flex", gap: "1rem" }}>
                  <span style={{ color: "#C8922A", fontFamily: MONO, fontSize: "0.75rem", flexShrink: 0, paddingTop: "0.15rem" }}>{String(i + 1).padStart(2, "0")}</span>
                  {item.question}
                </dt>
                <dd style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.85, paddingLeft: "2.5rem" }}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- CTA --- */}
      <section style={{ background: "#1A1B3A", padding: "6rem 0", position: "relative", overflow: "hidden" }}>
        <div className="absolute bottom-0 left-0 right-0 opacity-15">
          <Wave variant="fill" color="#F5ECD7" opacity={0.4} className="w-full h-20" />
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <p style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "1.5rem", marginBottom: "0.5rem" }}>召喚</p>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "#F5ECD7", marginBottom: "1rem" }}>{cta.headline}</h2>
          <p style={{ fontFamily: SANS, color: "#8A8078", fontSize: "1.05rem", marginBottom: "2.5rem" }}>{cta.subheadline}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={cta.primary.href} style={{ background: "#C1121F", color: "#F5ECD7", fontWeight: 700, padding: "0.875rem 2rem", borderRadius: "0.35rem", fontFamily: MONO, fontSize: "0.9rem" }} className="hover:opacity-90 transition-opacity">
              $ {cta.primary.label}
            </a>
            <a href={cta.secondary.href} style={{ border: "1px solid rgba(245,236,215,0.3)", color: "#F5ECD7", fontWeight: 600, padding: "0.875rem 2rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:border-[rgba(245,236,215,0.6)] transition-colors">
              {cta.secondary.label} &rarr;
            </a>
          </div>
          <a href={cta.tertiary.href} style={{ display: "block", marginTop: "1.5rem", color: "#6B7280", fontSize: "0.85rem", fontFamily: SANS }} className="hover:text-[#9CA3AF] transition-colors">
            {cta.tertiary.label}
          </a>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ background: "#F5ECD7", borderTop: "2px solid #1A1B3A", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p style={{ fontFamily: SERIF, color: "#1A1B3A", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>
                HeySummon <span style={{ color: "#C1121F", fontSize: "0.8rem" }}>召喚</span>
              </p>
              <p style={{ fontFamily: SANS, color: "#B0A898", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#B0A898", fontSize: "0.8rem" }} className="hover:text-[#1A1B3A] transition-colors">{link.label}</a>
              ))}
            </nav>
          </div>
          <div style={{ borderTop: "1px solid #D4CFC6", marginTop: "2rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
