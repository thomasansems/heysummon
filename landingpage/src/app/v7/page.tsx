// V7: THE NAMI (Wave)
// Full-screen hero, then dark navy sections with teal/green wave-inspired transitions.
// Rich, immersive. The artwork's ocean palette throughout.
// Serif headings, gold accents, deep colors. Almost cinematic.
//
// Palette:
// --v7-navy:    #0F0F1E  (deep dark)
// --v7-mid:     #1A1B3A  (navy)
// --v7-teal:    #1B3D35  (dark teal)
// --v7-teallt:  #2D6B5A  (lighter teal)
// --v7-gold:    #C8922A  (gold accent)
// --v7-red:     #C1121F  (vermillion)
// --v7-cream:   #F5ECD7  (text on dark)

import { Wave } from "@/components/wave";
import {
  nav, hero, problem, howItWorks, features,
  install, integrations, openSource, faq, cta, footer,
} from "@/content/site";

const SERIF = "'Noto Serif JP', Georgia, serif";
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', monospace";

export default function V7Nami() {
  return (
    <div className="min-h-screen" style={{ background: "#0F0F1E", color: "#F5ECD7" }}>
      {/* --- NAV --- */}
      <header style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, background: "rgba(15,15,30,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid #2A2B4A" }}>
        <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <a href="/" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "1.1rem", color: "#F5ECD7" }}>
            HeySummon <span style={{ color: "#C8922A", fontSize: "0.75rem" }}>召喚</span>
          </a>
          <div className="hidden md:flex items-center gap-8">
            {nav.links.map((link) => (
              <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#6B7280", fontSize: "0.85rem" }} className="hover:text-[#F5ECD7] transition-colors">{link.label}</a>
            ))}
          </div>
          <a href={nav.cta.href} style={{ background: "#C8922A", color: "#0F0F1E", fontWeight: 700, fontSize: "0.85rem", padding: "0.5rem 1.25rem", borderRadius: "0.35rem", fontFamily: SANS }} className="hover:opacity-90 transition-opacity">
            {nav.cta.label}
          </a>
        </nav>
      </header>

      {/* --- HERO: full viewport image --- */}
      <section className="relative" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="absolute inset-0">
          <img
            src="/sumo-hero.jpeg"
            alt="Neo-Ukiyo-e sumo wrestler standing in stylized ocean waves with a radiant sun behind — representing HeySummon, the human-in-the-loop API for AI agents"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 25%" }}
          />
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(15,15,30,0.4) 0%, rgba(15,15,30,0.2) 35%, rgba(15,15,30,0.7) 70%, #0F0F1E 100%)" }} />
        </div>

        <div className="relative z-10 flex-1 flex items-end">
          <div className="max-w-6xl mx-auto px-6 pb-20 pt-48 w-full">
            <div style={{ display: "inline-block", fontFamily: SERIF, color: "#C8922A", fontSize: "1.5rem", marginBottom: "1rem", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
              波 <span style={{ fontSize: "0.7rem", color: "#F5ECD7", opacity: 0.6, fontFamily: SANS, marginLeft: "0.5rem" }}>THE WAVE</span>
            </div>

            <h1 style={{ fontFamily: SERIF, fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", fontWeight: 900, lineHeight: 1.05, color: "#F5ECD7", marginBottom: "1.5rem", maxWidth: "600px", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
              {hero.headline}
            </h1>

            <p style={{ fontFamily: SANS, fontSize: "1.1rem", lineHeight: 1.7, color: "#D4CFC6", maxWidth: "480px", marginBottom: "2.5rem", textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}>
              {hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-4">
              <a href={hero.ctas[0].href} style={{ background: "#C8922A", color: "#0F0F1E", fontFamily: MONO, fontWeight: 600, fontSize: "0.9rem", padding: "0.8rem 1.75rem", borderRadius: "0.35rem", display: "flex", alignItems: "center", gap: "0.5rem", boxShadow: "0 4px 16px rgba(200,146,42,0.4)" }} className="hover:opacity-90 transition-opacity">
                <span style={{ opacity: 0.5 }}>$</span> {hero.ctas[0].label}
              </a>
              <a href={hero.ctas[1].href} style={{ background: "rgba(15,15,30,0.5)", backdropFilter: "blur(8px)", border: "1px solid rgba(200,146,42,0.3)", color: "#F5ECD7", fontWeight: 600, fontSize: "0.875rem", padding: "0.8rem 1.75rem", borderRadius: "0.35rem", fontFamily: SANS }} className="hover:border-[#C8922A] transition-all">
                {hero.ctas[1].label} &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* --- PROBLEM --- (navy) */}
      <section style={{ padding: "5rem 0", background: "#0F0F1E" }}>
        <div className="max-w-4xl mx-auto px-6">
          <span style={{ fontFamily: SERIF, fontSize: "2rem", color: "#C8922A", opacity: 0.25 }}>問題</span>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "2rem" }}>{problem.headline}</h2>

          <blockquote style={{ borderLeft: "3px solid #C1121F", paddingLeft: "1.5rem", marginBottom: "2.5rem", fontFamily: SERIF, color: "#D4CFC6", fontStyle: "italic", fontSize: "1.05rem" }}>
            {problem.callout}
          </blockquote>

          <div className="space-y-4">
            {problem.body.map((para, i) => (
              <p key={i} style={{ fontFamily: SANS, color: "#8A8078", lineHeight: 1.85 }}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Wave transition */}
      <div style={{ background: "#1B3D35" }}><Wave variant="fill" color="#0F0F1E" opacity={1} className="w-full h-12" /></div>

      {/* --- HOW IT WORKS --- (teal) */}
      <section style={{ padding: "5rem 0", background: "#1B3D35" }}>
        <div className="max-w-6xl mx-auto px-6">
          <span style={{ fontFamily: SERIF, fontSize: "2rem", color: "#C8922A", opacity: 0.3 }}>仕組み</span>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "3rem" }}>{howItWorks.headline}</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.steps.map((step, i) => (
              <div key={i} style={{ background: "rgba(245,236,215,0.05)", border: "1px solid rgba(245,236,215,0.1)", borderRadius: "0.75rem", padding: "1.75rem" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#C8922A", background: "rgba(200,146,42,0.1)", padding: "0.25rem 0.5rem", borderRadius: "0.25rem" }}>{step.number}</span>
                <h3 style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#F5ECD7", marginTop: "1rem", marginBottom: "0.75rem" }}>{step.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.85rem", color: "#8A9A90", lineHeight: 1.75 }}>{step.description}</p>
                {step.code && (
                  <pre style={{ marginTop: "1rem", background: "#0F0F1E", borderRadius: "0.35rem", padding: "0.75rem 1rem", fontSize: "0.72rem", color: "#C8922A", fontFamily: MONO, overflow: "auto", whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
                    {step.code}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave transition */}
      <div style={{ background: "#1A1B3A" }}><Wave variant="fill" color="#1B3D35" opacity={1} className="w-full h-12" /></div>

      {/* --- FEATURES --- (navy) */}
      <section style={{ padding: "5rem 0", background: "#1A1B3A" }}>
        <div className="max-w-6xl mx-auto px-6">
          <span style={{ fontFamily: SERIF, fontSize: "2rem", color: "#C8922A", opacity: 0.25 }}>特徴</span>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "3rem" }}>What makes HeySummon different.</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feat) => (
              <div key={feat.id} style={{ border: "1px solid #2A2B4A", borderRadius: "0.75rem", padding: "2rem" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: "1rem", fontWeight: 700, color: "#F5ECD7", marginBottom: "0.6rem" }}>{feat.title}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.75, marginBottom: "1rem" }}>{feat.description}</p>
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#C8922A" }}>{feat.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave transition */}
      <div style={{ background: "#0F0F1E" }}><Wave variant="fill" color="#1A1B3A" opacity={1} className="w-full h-12" /></div>

      {/* --- INSTALL --- (deep dark) */}
      <section id="install" style={{ padding: "5rem 0", background: "#0F0F1E" }}>
        <div className="max-w-6xl mx-auto px-6">
          <span style={{ fontFamily: SERIF, fontSize: "2rem", color: "#C8922A", opacity: 0.25 }}>導入</span>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "2.5rem" }}>{install.headline}</h2>

          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              {install.options.map((opt, i) => (
                <div key={i} style={{ border: "1px solid #2A2B4A", borderRadius: "0.5rem", overflow: "hidden" }}>
                  <div style={{ background: "#1A1B3A", padding: "0.6rem 1rem" }}>
                    <span style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#C8922A" }}>{opt.label}</span>
                  </div>
                  <div style={{ padding: "1.25rem" }}>
                    <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#6B7280", marginBottom: "0.75rem" }}>{opt.description}</p>
                    <pre style={{ fontFamily: MONO, fontSize: "0.875rem", color: "#F5ECD7", fontWeight: 600 }}>
                      <span style={{ color: "#C8922A" }}>$ </span>{opt.code}
                    </pre>
                    {opt.sub && <pre style={{ marginTop: "0.5rem", fontFamily: MONO, fontSize: "0.75rem", color: "#4B5563", lineHeight: 1.8 }}>{opt.sub}</pre>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ background: "#1A1B3A", border: "1px solid #2A2B4A", borderRadius: "0.5rem", overflow: "hidden" }}>
              <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #2A2B4A" }}>
                <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: "#C8922A" }}>@heysummon/sdk</span>
              </div>
              <pre style={{ padding: "1.5rem", fontFamily: MONO, fontSize: "0.78rem", color: "#D4CFC6", lineHeight: 1.9, overflow: "auto", whiteSpace: "pre-wrap" }}>{install.sdkSnippet}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* --- INTEGRATIONS --- */}
      <section style={{ padding: "5rem 0", background: "#1B3D35" }}>
        <div className="max-w-6xl mx-auto px-6">
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7", marginBottom: "3rem" }}>{integrations.headline}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {integrations.items.map((item) => (
              <div key={item.name} style={{ background: "rgba(245,236,215,0.05)", border: "1px solid rgba(245,236,215,0.1)", borderRadius: "0.5rem", padding: "1.5rem" }}>
                <h3 style={{ fontFamily: SERIF, fontSize: "0.9rem", fontWeight: 700, color: "#F5ECD7", marginBottom: "0.5rem" }}>{item.name}</h3>
                <p style={{ fontFamily: SANS, fontSize: "0.8rem", color: "#8A9A90", lineHeight: 1.7, marginBottom: "0.75rem" }}>{item.description}</p>
                <p style={{ fontFamily: MONO, fontSize: "0.7rem", color: "#C8922A" }}>{item.setup}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- FAQ --- */}
      <section style={{ padding: "5rem 0", background: "#0F0F1E" }}>
        <div className="max-w-3xl mx-auto px-6">
          <span style={{ fontFamily: SERIF, fontSize: "2rem", color: "#C8922A", opacity: 0.25 }}>質問</span>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 700, color: "#F5ECD7", marginTop: "0.5rem", marginBottom: "3rem" }}>{faq.headline}</h2>
          <dl>
            {faq.items.map((item, i) => (
              <div key={i} style={{ borderTop: "1px solid #2A2B4A", padding: "1.75rem 0", borderBottom: i === faq.items.length - 1 ? "1px solid #2A2B4A" : "none" }}>
                <dt style={{ fontFamily: SERIF, fontSize: "0.95rem", fontWeight: 700, color: "#F5ECD7", marginBottom: "0.75rem" }}>{item.question}</dt>
                <dd style={{ fontFamily: SANS, fontSize: "0.875rem", color: "#8A8078", lineHeight: 1.85 }}>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* --- CTA --- */}
      <section style={{ padding: "6rem 0", background: "linear-gradient(135deg, #1B3D35, #1A1B3A)", position: "relative", overflow: "hidden" }}>
        <div className="absolute inset-0 opacity-10"><Wave variant="simple" color="#C8922A" rows={5} className="w-full h-full" /></div>
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
          <p style={{ fontFamily: SERIF, color: "#C8922A", fontSize: "2rem", marginBottom: "0.5rem" }}>召喚</p>
          <h2 style={{ fontFamily: SERIF, fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 900, color: "#F5ECD7", marginBottom: "1rem" }}>{cta.headline}</h2>
          <p style={{ fontFamily: SANS, color: "#8A8078", fontSize: "1.05rem", marginBottom: "2.5rem" }}>{cta.subheadline}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href={cta.primary.href} style={{ background: "#C8922A", color: "#0F0F1E", fontWeight: 700, padding: "0.875rem 2rem", borderRadius: "0.35rem", fontFamily: MONO, fontSize: "0.9rem" }} className="hover:opacity-90 transition-opacity">$ {cta.primary.label}</a>
            <a href={cta.secondary.href} style={{ border: "1px solid rgba(200,146,42,0.4)", color: "#F5ECD7", fontWeight: 600, padding: "0.875rem 2rem", borderRadius: "0.35rem", fontSize: "0.875rem", fontFamily: SANS }} className="hover:border-[#C8922A] transition-colors">{cta.secondary.label} &rarr;</a>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer style={{ background: "#0F0F1E", borderTop: "1px solid #2A2B4A", padding: "3rem 0" }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div>
              <p style={{ fontFamily: SERIF, color: "#F5ECD7", fontWeight: 700, fontSize: "1rem", marginBottom: "0.25rem" }}>HeySummon <span style={{ color: "#C8922A", fontSize: "0.75rem" }}>召喚</span></p>
              <p style={{ fontFamily: SANS, color: "#4B5563", fontSize: "0.8rem" }}>{footer.tagline}</p>
            </div>
            <nav className="flex flex-wrap gap-6">
              {footer.links.map((link) => (
                <a key={link.label} href={link.href} style={{ fontFamily: SANS, color: "#4B5563", fontSize: "0.8rem" }} className="hover:text-[#8A8078] transition-colors">{link.label}</a>
              ))}
            </nav>
          </div>
          <div style={{ borderTop: "1px solid #2A2B4A", marginTop: "2rem", paddingTop: "1.5rem", display: "flex", justifyContent: "space-between" }}>
            <p style={{ color: "#2A2B4A", fontSize: "0.75rem" }}>{footer.copyright}</p>
            <p style={{ color: "#2A2B4A", fontSize: "0.75rem" }}>{footer.license}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
