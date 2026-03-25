// V8: THE FUDE (Brush)
// Boldest typographic approach. Oversized Japanese characters as design elements.
// Full-screen hero, then cream sections with huge kanji watermarks.
// Most artistic and brand-forward. Heavy serif usage.
//
// Palette:
// --v8-navy:    #1A1B3A
// --v8-red:     #C1121F
// --v8-gold:    #C8922A
// --v8-teal:    #2D6B5A
// --v8-cream:   #F5ECD7
// --v8-paper:   #EDE6D5

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

const SERIF = "'Noto Serif JP', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

function Kanji({ char, className = "" }: { char: string; className?: string }) {
  return (
    <span
      className={`pointer-events-none select-none ${className}`}
      style={{
        fontFamily: SERIF,
        fontSize: "clamp(10rem, 20vw, 18rem)",
        fontWeight: 900,
        lineHeight: 1,
        position: "absolute",
        color: "currentColor",
        opacity: 0.04,
      }}
      aria-hidden="true"
    >
      {char}
    </span>
  );
}

export default function V8Fude() {
  return (
    <div className="min-h-screen" style={{ background: "#F5ECD7", color: "#1A1B3A" }}>
      {/* --- NAV --- */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(245,236,215,0.92)", backdropFilter: "blur(10px)", borderBottom: "1px solid #D4CFC6" }}>
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ fontFamily: SERIF, fontWeight: 900, fontSize: "1.2rem", color: "#1A1B3A", display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
            <span style={{ fontFamily: SERIF, color: "#C1121F", fontSize: "1.4rem" }}>召喚</span>
            HeySummon
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#8A8078", fontSize: "0.85rem" }} className="hover:text-[#1A1B3A] transition-colors">{link.label}</a>
            ))}
          </div>
          <a href={nav.cta.href} style={{ background: "#C1121F", color: "#F5ECD7", fontWeight: 700, fontSize: "0.85rem", padding: "0.5rem 1.25rem", borderRadius: "0.35rem", fontFamily: SANS }} className="hover:opacity-90 transition-opacity">
            {nav.cta.label}
          </a>
        </nav>
      </header>

      {/* --- HERO: full viewport image with big text overlay --- */}
      <section className="relative" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="absolute inset-0">
          <img
            src="/sumo-hero.jpeg"
            alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(26,27,58,0.5) 0%, rgba(26,27,58,0.2) 30%, rgba(26,27,58,0.6) 65%, rgba(245,236,215,1) 100%)" }} />
        </div>

        <div className="relative z-10 flex-1 flex items-center">
          <div className="max-w-6xl mx-auto px-6 w-full" style={{ paddingTop: "6rem" }}>
            {/* Large vertical Japanese text */}
            <div style={{ position: "absolute", right: "8%", top: "20%", fontFamily: SERIF, fontSize: "clamp(4rem, 10vw, 8rem)", color: "rgba(200,146,42,0.2)", writingMode: "vertical-rl", letterSpacing: "0.2em", textShadow: "0 2px 20px rgba(0,0,0,0.3)" }}>
              召喚
            </div>

            <p style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "1rem", letterSpacing: "0.15em", marginBottom: "1.5rem", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}>
              {hero.eyebrow}
            </p>

            <h1 style={{ fontFamily: SERIF, fontSize: "clamp(3rem, 6vw, 5rem)", fontWeight: 900, lineHeight: 1.0, color: "#F5ECD7", marginBottom: "1.75rem", maxWidth: "700px", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
              {hero.headline}
            </h1>

            <p style={{ fontFamily: SANS, fontSize: "1.1rem", lineHeight: 1.7, color: "#E8DFC8", maxWidth: "500px", marginBottom: "3rem", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              {hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-4">
              <a href={hero.ctas[0].href} style={{ background: "#C1121F", color: "#F5ECD7", fontFamily: MONO, fontWeight: 600, fontSize: "0.9rem", padding: "0.9rem 2rem", borderRadius: "0.35rem", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 4px 16px rgba(193,18,31,0.4)" }} className="hover:opacity-90 transition-opacity">
                <span style={{ opacity: 0.5 }}>$</span> {hero.ctas[0].label}
              </a>
              <a href={hero.ctas[1].href} style={{ background: "rgba(26,27,58,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(245,236,215,0.3)", color: "#F5ECD7", fontWeight: 600, fontSize: "0.875rem", padding: "0.9rem 2rem", borderRadius: "0.35rem", fontFamily: SANS }} className="hover:border-[rgba(245,236,215,0.6)] transition-all">
                {hero.ctas[1].label} &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM --- */}
      <section className="relative overflow-hidden" style={{ padding: "6rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <Kanji char="問" className="right-[-3rem] top-[1rem]" />
        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 900, color: "#1A1B3A", marginBottom: "2.5rem", lineHeight: 1.15 }}>
            {problem.headline}
          </h2>

          <blockquote style={{ background: "#1A1B3A", color: "#F5ECD7", padding: "2rem 2.5rem", borderRadius: "0.5rem", marginBottom: "2.5rem", fontFamily: SERIF, fontStyle: "italic", fontSize: "1.1rem", lineHeight: 1.6, position: "relative" }}>
            <span style={{ position: "absolute", top: "0.5rem", left: "1rem", fontFamily: SERIF, fontSize: "3rem", color: "#C8922A", opacity: 0.3, lineHeight: 1 }}>&ldquo;</span>
            <span style={{ position: "relative", zIndex: 1 }}>{problem.callout}</span>
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ fontFamily: SANS, color: "#8A8078", lineHeight: 1.85, fontSize: "1rem" }}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="relative overflow-hidden" style={{ padding: "6rem 0", background: "#EDE6D5", borderBottom: "1px solid #D4CFC6" }}>
        <Kanji char="道" className="left-[-2rem] top-[2rem]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 900, color: "#1A1B3A", marginBottom: "3.5rem" }}>
            {howItWorks.headline}
          </h2>

          <div className="grid md:grid-cols-3 gap-10">
            {howItWorks.steps.map((step, i) => (
              <div key={i}>
                <div style={{ fontFamily: SERIF, fontSize: "4rem", fontWeight: 900, color: "#C8922A", opacity: 0.15, lineHeight: 1 }}>{step.number}</div>
                <div style={{ borderTop: "3px solid #C1121F", paddingTop: "1.5rem", marginTop: "-0.5rem" }}>
                  <h3 style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.75rem" }}>{step.title}</h3>
                  <p style={{ fontFamily: SANS, fontSize: "0.9rem", color: "#8A8078", lineHeight: 1.75 }}>{step.description}</p>
                  {step.code && (
                    <pre style={{ marginTop: "1.25rem", background: "#1A1B3A", borderRadius: "0.5rem", padding: "1rem 1.25rem", fontSize: "0.75rem", color: "#F5ECD7", fontFamily: MONO, overflow: "auto", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
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
      <section className="relative overflow-hidden" style={{ padding: "6rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <Kanji char="力" className="right-[-1rem] bottom-[2rem]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 2.5rem)", fontWeight: 900, color: "#1A1B3A", marginBottom: "3.5rem" }}>
            What makes HeySummon different.
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feat) => (
              <div key={feat.id} style={{ padding: "2rem", border: "2px solid #1A1B3A", borderRadius: "0.5rem", position: "relative" }}>
                <div style={{ position: "absolute", top: "-0.75rem", left: "1.5rem", background: "#F5ECD7", padding: "0 0.5rem" }}>
                  <span style={{ fontFamily: MONO, fontSize: "0.7rem", fontWeight: 600, color: "#C1121F", letterSpacing: "0.05em" }}>{feat.detail}</span>
                </div>
                <h3 style={{ fontFamily: SERIF, fontSize: "1.1rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.75rem", marginTop: "0.5rem" }}>{feat.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.9rem", color: "#8A8078", lineHeight: 1.75 }}>{feat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INSTALL --- */}
      <section id="install" className="relative overflow-hidden" style={{ padding: "6rem 0", background: "#EDE6D5", borderBottom: "1px solid #D4CFC6" }}>
        <Kanji char="導" className="left-[-3rem] top-[1rem]" />
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 900, color: "#1A1B3A", marginBottom: "3rem" }}>{install.headline}</h2>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div key={i} style={{ background: "#F5ECD7", border: "2px solid #1A1B3A", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <div style={{ background: "#1A1B3A", padding: "0.75rem 1.25rem" }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#C8922A" }}>{opt.label}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#8A8078", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: MONO, fontSize: "0.9rem", color: "#1A1B3A", fontWeight: 700 }}>
                      <span style={{ color: "#C1121F" }}>$ </span>{opt.code}
                    </pre>
                    {opt.sub && <pre style={{ marginTop: "0.5rem", fontFamily: MONO, fontSize: "0.75rem", color: "#B0A898", lineHeight: 1.8 }}>{opt.sub}</pre>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1A1B3A", border: "2px solid #1A1B3A", borderRadius: "0.5rem", overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1.25rem", borderBottom: "1px solid rgba(200,146,42,0.2)" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#C8922A" }}>@heysummon/sdk</span>
              </div>
              <pre style={{ padding: "1.5rem", fontFamily: MONO, fontSize: "0.8rem", color: "#D4CFC6", lineHeight: 1.9, overflow: "auto", whiteSpace: "pre-wrap" }}>{install.sdkSnippet}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* --- INTEGRATIONS --- */}
      <section className="relative overflow-hidden" style={{ padding: "6rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 2.5rem)", fontWeight: 900, color: "#1A1B3A", marginBottom: "3.5rem" }}>{integrations.headline}</h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {integrations.items.map((item) => (
              <div key={item.name} style={{ borderTop: "4px solid #C8922A", paddingTop: "1.5rem" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.5rem" }}>{item.name}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#8A8078", lineHeight: 1.7, marginBottom: "0.75rem" }}>{item.description}</p>
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#2D6B5A" }}>{item.setup}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- OPEN SOURCE --- */}
      <section style={{ padding: "6rem 0", background: "#1A1B3A", color: "#F5ECD7" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span style={{ fontFamily: SERIF, fontSize: "3rem", color: "#C8922A", opacity: 0.3 }}>公開</span>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 900, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "1.5rem" }}>{openSource.headline}</h2>
              <p style={{ fontFamily: SANS, color: "#8A8078", lineHeight: 1.85, marginBottom: "2rem" }}>{openSource.body}</p>
              <a href={openSource.github} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#C8922A", color: "#0F0F1E", fontWeight: 700, padding: "0.8rem 1.75rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:opacity-90 transition-opacity">
                View on GitHub &rarr;
              </a>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {openSource.stats.map((stat) => (
                <div key={stat.label} style={{ border: "1px solid #2A2B4A", borderRadius: "0.5rem", padding: "1.5rem" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#6B7280", marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</p>
                  <p style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#C8922A" }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section className="relative overflow-hidden" style={{ padding: "6rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <Kanji char="答" className="right-[-2rem] top-[3rem]" />
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 3.5vw, 3rem)", fontWeight: 900, color: "#1A1B3A", marginBottom: "3.5rem" }}>{faq.headline}</h2>
          <dl>
            {faq.items.map((item, i) => (
              <div key={i} style={{ borderTop: "1px solid #D4CFC6", padding: "2rem 0", borderBottom: i === faq.items.length - 1 ? "1px solid #D4CFC6" : "none" }}>
                <dt style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.75rem" }}>{item.question}</dt>
                <dd style={{ fontFamily: SANS, fontSize: "0.9rem", color: "#8A8078", lineHeight: 1.85 }}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- CTA --- */}
      <section className="relative overflow-hidden" style={{ padding: "7rem 0", background: "#1A1B3A" }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
          <span style={{ fontFamily: SERIF, fontSize: "clamp(15rem, 30vw, 25rem)", fontWeight: 900, color: "rgba(200,146,42,0.04)", lineHeight: 1 }}>召喚</span>
        </div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2.5rem, 5vw, 4rem)", fontWeight: 900, color: "#F5ECD7", marginBottom: "1.25rem" }}>{cta.headline}</h2>
          <p style={{ fontFamily: SANS, color: "#8A8078", fontSize: "1.1rem", marginBottom: "3rem" }}>{cta.subheadline}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={cta.primary.href} style={{ background: "#C1121F", color: "#F5ECD7", fontWeight: 700, padding: "1rem 2.5rem", borderRadius: "0.35rem", fontFamily: MONO, fontSize: "0.9rem", boxShadow: "0 4px 16px rgba(193,18,31,0.4)" }} className="hover:opacity-90 transition-opacity">$ {cta.primary.label}</a>
            <a href={cta.secondary.href} style={{ border: "1px solid rgba(245,236,215,0.3)", color: "#F5ECD7", fontWeight: 600, padding: "1rem 2.5rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:border-[rgba(245,236,215,0.6)] transition-colors">{cta.secondary.label} &rarr;</a>
          </div>
          <a href={cta.tertiary.href} style={{ display: "block", marginTop: "2rem", color: "#6B7280", fontSize: "0.85rem", fontFamily: SANS }} className="hover:text-[#9CA3AF] transition-colors">{cta.tertiary.label}</a>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ background: "#F5ECD7", borderTop: "3px solid #1A1B3A", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p style={{ fontFamily: SERIF, color: "#1A1B3A", fontWeight: 900, fontSize: "1.1rem", marginBottom: "0.25rem" }}>
                <span style={{ color: "#C1121F" }}>召喚</span> HeySummon
              </p>
              <p style={{ fontFamily: SANS, color: "#B0A898", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#B0A898", fontSize: "0.8rem" }} className="hover:text-[#1A1B3A] transition-colors">{link.label}</a>
              ))}
            </nav>
          </div>
          <div style={{ borderTop: "1px solid #D4CFC6", marginTop: "2rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between" }}>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
