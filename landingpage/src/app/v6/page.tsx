// V6: THE DOHYO
// Split-screen hero: image left, text right. Editorial magazine feel.
// Navy as primary dark, gold accents on teal surfaces.
// Serif headings, clean horizontal rules, structured sections.
//
// Palette:
// --v6-navy:     #1A1B3A
// --v6-gold:     #C8922A
// --v6-teal:     #1B3D35
// --v6-teallt:   #2D6B5A
// --v6-red:      #C1121F
// --v6-cream:    #F5ECD7
// --v6-surface:  #E8DFC8

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

const SERIF = "'Noto Serif JP', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

function GoldRule() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "2.5rem 0" }}>
      <div style={{ width: "2rem", height: "2px", background: "#C8922A" }} />
      <div style={{ flex: 1, height: "1px", background: "#D4CFC6" }} />
    </div>
  );
}

export default function V6Dohyo() {
  return (
    <div className="min-h-screen" style={{ background: "#F5ECD7", color: "#1A1B3A" }}>
      {/* --- NAV --- */}
      <header style={{ borderBottom: "1px solid #D4CFC6", position: "sticky", top: 0, zIndex: 50, background: "rgba(245,236,215,0.92)", backdropFilter: "blur(10px)" }}>
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "1.1rem", color: "#1A1B3A", display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            HeySummon <span style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "0.7rem" }}>召喚</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#8A8078", fontSize: "0.85rem" }} className="hover:text-[#1A1B3A] transition-colors">{link.label}</a>
            ))}
          </div>
          <a href={nav.cta.href} style={{ background: "#1A1B3A", color: "#F5ECD7", fontWeight: 600, fontSize: "0.85rem", padding: "0.5rem 1.25rem", borderRadius: "0.35rem", fontFamily: SANS }} className="hover:opacity-90 transition-opacity">
            {nav.cta.label}
          </a>
        </nav>
      </header>

      {/* --- HERO: split-screen --- */}
      <section style={{ minHeight: "92vh", display: "flex" }}>
        {/* Left: image */}
        <div className="hidden lg:block" style={{ width: "50%", position: "relative" }}>
          <img
            src="/sumo-hero.jpeg"
            alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
          />
          {/* Subtle fade into cream */}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, transparent 80%, #F5ECD7 100%)" }} />
          <div className="absolute bottom-0 left-0 right-0" style={{ height: "20%", background: "linear-gradient(transparent, #F5ECD7)" }} />
        </div>

        {/* Right: content */}
        <div className="flex-1 flex items-center" style={{ padding: "4rem 3rem 4rem 2.5rem" }}>
          <div style={{ maxWidth: "540px" }}>
            <p style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "0.85rem", letterSpacing: "0.1em", marginBottom: "2rem" }}>
              {hero.eyebrow}
            </p>

            <h1 style={{ fontFamily: SERIF, fontSize: "clamp(2.5rem, 4vw, 3.5rem)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.02em", color: "#1A1B3A", marginBottom: "1.75rem" }}>
              {hero.headline}
            </h1>

            <p style={{ fontFamily: SANS, fontSize: "1.05rem", lineHeight: 1.7, color: "#8A8078", marginBottom: "2.5rem" }}>
              {hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-4 mb-6">
              <a href={hero.ctas[0].href} style={{ background: "#1A1B3A", color: "#F5ECD7", fontFamily: MONO, fontWeight: 500, fontSize: "0.875rem", padding: "0.8rem 1.5rem", borderRadius: "0.35rem", display: "flex", alignItems: "center", gap: "0.5rem" }} className="hover:opacity-90 transition-opacity">
                <span style={{ color: "#C8922A" }}>$</span> {hero.ctas[0].label}
              </a>
              <a href={hero.ctas[1].href} style={{ border: "2px solid #1A1B3A", color: "#1A1B3A", fontWeight: 700, fontSize: "0.875rem", padding: "0.8rem 1.5rem", borderRadius: "0.35rem", fontFamily: SANS }} className="hover:bg-[#1A1B3A] hover:text-[#F5ECD7] transition-all">
                {hero.ctas[1].label} &rarr;
              </a>
            </div>

            <p style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#B0A898" }}>{hero.badge}</p>

            {/* Mobile image fallback */}
            <div className="lg:hidden mt-8" style={{ border: "3px solid #1A1B3A", padding: "4px" }}>
              <img src="/sumo-hero.jpeg" alt="HeySummon sumo wrestler" style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM --- */}
      <section style={{ padding: "5rem 0", borderTop: "2px solid #1A1B3A", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-4xl mx-auto px-6">
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
            <span style={{ fontFamily: SERIF, fontSize: "3rem", lineHeight: 1, color: "#C8922A", opacity: 0.3, flexShrink: 0 }}>問</span>
            <div>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "2rem" }}>{problem.headline}</h2>

              <blockquote style={{ borderLeft: "3px solid #C1121F", paddingLeft: "1.5rem", marginBottom: "2.5rem", fontFamily: SERIF, color: "#1A1B3A", fontStyle: "italic", fontSize: "1.05rem" }}>
                {problem.callout}
              </blockquote>

              <div className="space-y-4">
                {problem.body.map((para, i) => (
                  <p key={i} style={{ fontFamily: SANS, color: "#8A8078", lineHeight: 1.85 }}>{para}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section style={{ padding: "5rem 0", background: "#1A1B3A", color: "#F5ECD7" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", marginBottom: "3rem" }}>
            <span style={{ fontFamily: SERIF, fontSize: "3rem", lineHeight: 1, color: "#C8922A", opacity: 0.4, flexShrink: 0 }}>道</span>
            <div>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7" }}>{howItWorks.headline}</h2>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {howItWorks.steps.map((step, i) => (
              <div key={i} style={{ borderLeft: "2px solid #C8922A", paddingLeft: "1.5rem" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#C8922A" }}>{step.number}</span>
                <h3 style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "0.75rem" }}>{step.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#8A8078", lineHeight: 1.75 }}>{step.description}</p>
                {step.code && (
                  <pre style={{ marginTop: "1rem", background: "#0F0F1E", border: "1px solid #2A2B4A", borderRadius: "0.35rem", padding: "0.75rem 1rem", fontSize: "0.72rem", color: "#C8922A", fontFamily: MONO, overflow: "auto", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {step.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FEATURES --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", marginBottom: "3rem" }}>
            <span style={{ fontFamily: SERIF, fontSize: "3rem", lineHeight: 1, color: "#C8922A", opacity: 0.3, flexShrink: 0 }}>力</span>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, color: "#1A1B3A" }}>What makes HeySummon different.</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feat) => (
              <div key={feat.id} style={{ background: "#EDE6D5", borderRadius: "0.5rem", padding: "2rem", borderLeft: "3px solid #C8922A" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.6rem" }}>{feat.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.75, marginBottom: "1rem" }}>{feat.description}</p>
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#2D6B5A" }}>{feat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- INSTALL --- */}
      <section id="install" style={{ padding: "5rem 0", background: "#EDE6D5", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", marginBottom: "2.5rem" }}>
            <span style={{ fontFamily: SERIF, fontSize: "3rem", lineHeight: 1, color: "#C8922A", opacity: 0.3, flexShrink: 0 }}>導</span>
            <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A" }}>{install.headline}</h2>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div key={i} style={{ background: "#F5ECD7", border: "1px solid #D4CFC6", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <div style={{ background: "#1A1B3A", padding: "0.6rem 1rem" }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#C8922A" }}>{opt.label}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#8A8078", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: MONO, fontSize: "0.875rem", color: "#1A1B3A", fontWeight: 600 }}>
                      <span style={{ color: "#C1121F" }}>$ </span>{opt.code}
                    </pre>
                    {opt.sub && <pre style={{ marginTop: "0.5rem", fontFamily: MONO, fontSize: "0.75rem", color: "#B0A898", lineHeight: 1.8 }}>{opt.sub}</pre>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1A1B3A", borderRadius: "0.5rem", overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(200,146,42,0.2)" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#C8922A" }}>@heysummon/sdk</span>
              </div>
              <pre style={{ padding: "1.5rem", fontFamily: MONO, fontSize: "0.78rem", color: "#D4CFC6", lineHeight: 1.9, overflow: "auto", whiteSpace: "pre-wrap" }}>{install.sdkSnippet}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* --- INTEGRATIONS --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "3rem" }}>{integrations.headline}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-0" style={{ border: "2px solid #1A1B3A", borderRadius: "0.5rem", overflow: "hidden" }}>
            {integrations.items.map((item, i) => (
              <div key={item.name} style={{ padding: "1.5rem", borderRight: i < 3 ? "1px solid #D4CFC6" : "none" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.5rem" }}>{item.name}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.78rem", color: "#8A8078", lineHeight: 1.7, marginBottom: "0.75rem" }}>{item.description}</p>
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#2D6B5A" }}>{item.setup}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- OPEN SOURCE --- */}
      <section style={{ padding: "5rem 0", background: "#2D6B5A", color: "#F5ECD7" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span style={{ fontFamily: SERIF, fontSize: "2rem", color: "#C8922A", opacity: 0.4 }}>公開</span>
              <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "1.5rem" }}>{openSource.headline}</h2>
              <p style={{ fontFamily: SANS, color: "#B0C4B0", lineHeight: 1.85, marginBottom: "2rem" }}>{openSource.body}</p>
              <a href={openSource.github} style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#F5ECD7", color: "#2D6B5A", fontWeight: 700, padding: "0.75rem 1.5rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:opacity-90 transition-opacity">
                View on GitHub &rarr;
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {openSource.stats.map((stat) => (
                <div key={stat.label} style={{ background: "rgba(245,236,215,0.1)", border: "1px solid rgba(245,236,215,0.15)", borderRadius: "0.5rem", padding: "1.25rem" }}>
                  <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#B0C4B0", marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</p>
                  <p style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, color: "#C8922A" }}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section style={{ padding: "5rem 0", borderBottom: "1px solid #D4CFC6" }}>
        <div className="max-w-3xl mx-auto px-6">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#1A1B3A", marginBottom: "3rem" }}>{faq.headline}</h2>
          <dl>
            {faq.items.map((item, i) => (
              <div key={i} style={{ borderTop: "1px solid #D4CFC6", padding: "1.75rem 0", borderBottom: i === faq.items.length - 1 ? "1px solid #D4CFC6" : "none" }}>
                <dt style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, color: "#1A1B3A", marginBottom: "0.75rem" }}>{item.question}</dt>
                <dd style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.85 }}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- CTA --- */}
      <section style={{ background: "#1A1B3A", padding: "6rem 0", position: "relative", overflow: "hidden" }}>
        <div className="absolute bottom-0 left-0 right-0 opacity-10"><Wave variant="fill" color="#C8922A" opacity={0.5} className="w-full h-20" /></div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <p style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "1.5rem", marginBottom: "0.5rem" }}>始</p>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "#F5ECD7", marginBottom: "1rem" }}>{cta.headline}</h2>
          <p style={{ fontFamily: SANS, color: "#8A8078", fontSize: "1.05rem", marginBottom: "2.5rem" }}>{cta.subheadline}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={cta.primary.href} style={{ background: "#F5ECD7", color: "#1A1B3A", fontWeight: 700, padding: "0.875rem 2rem", borderRadius: "0.35rem", fontFamily: MONO, fontSize: "0.9rem" }} className="hover:opacity-90 transition-opacity">$ {cta.primary.label}</a>
            <a href={cta.secondary.href} style={{ border: "1px solid rgba(245,236,215,0.3)", color: "#F5ECD7", fontWeight: 600, padding: "0.875rem 2rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:border-[rgba(245,236,215,0.6)] transition-colors">{cta.secondary.label} &rarr;</a>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ background: "#F5ECD7", borderTop: "2px solid #1A1B3A", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p style={{ fontFamily: SERIF, color: "#1A1B3A", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>HeySummon</p>
              <p style={{ fontFamily: SANS, color: "#B0A898", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#B0A898", fontSize: "0.8rem" }} className="hover:text-[#1A1B3A] transition-colors">{link.label}</a>
              ))}
            </nav>
          </div>
          <GoldRule />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#D4CFC6", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
