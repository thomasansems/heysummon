// Version selector — choose between the 3 landing page designs
// Delete this file and rename the chosen version to page.tsx when ready to deploy

export default function VersionSelector() {
  const versions = [
    {
      id: "v1",
      name: "The Dojo",
      description: "Dark, bold, Neo-Ukiyo-e poster. Coral on near-black. Dramatic.",
      preview: "bg-[#0A0A14] text-[#FF6B4A]",
      href: "/v1",
    },
    {
      id: "v2",
      name: "The Scroll",
      description: "Warm cream, editorial. Vermillion red + navy. Traditional woodblock.",
      preview: "bg-[#F5F0E8] text-[#C1121F]",
      href: "/v2",
    },
    {
      id: "v3",
      name: "The Gateway",
      description: "Modern SaaS with Japanese accents. Brand gradient. Clean and professional.",
      preview: "bg-white text-[#FF6B4A]",
      href: "/v3",
    },
    {
      id: "v4",
      name: "The Arena",
      description: "Brutalist terminal aesthetic. Monochrome with gradient accents. Developer-first.",
      preview: "bg-black text-[#22C55E]",
      href: "/v4",
    },
    {
      id: "v5",
      name: "The Yokozuna",
      description: "V2 refined. Full-screen hero image, Noto Serif JP headings, Japanese section labels.",
      preview: "bg-[#F5ECD7] text-[#C1121F]",
      href: "/v5",
    },
    {
      id: "v6",
      name: "The Dohyo",
      description: "Split-screen hero. Image left, text right. Magazine editorial. Teal open-source section.",
      preview: "bg-[#F5ECD7] text-[#1A1B3A]",
      href: "/v6",
    },
    {
      id: "v7",
      name: "The Nami",
      description: "Full dark immersive. Navy/teal/green wave-inspired sections. Gold accents. Cinematic.",
      preview: "bg-[#0F0F1E] text-[#C8922A]",
      href: "/v7",
    },
    {
      id: "v8",
      name: "The Fude",
      description: "Boldest typography. Oversized kanji watermarks. Vermillion + gold. Most artistic.",
      preview: "bg-[#F5ECD7] text-[#C8922A]",
      href: "/v8",
    },
  ];

  return (
    <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        <div className="mb-10 text-center">
          <p className="text-gray-500 text-sm font-mono mb-2">heysummon.ai / landing page</p>
          <h1 className="text-white text-3xl font-bold mb-3">Choose a design version</h1>
          <p className="text-gray-400">
            Preview each version, then replace <code className="text-gray-300 bg-gray-800 px-1 rounded">src/app/page.tsx</code> with your choice.
          </p>
        </div>

        <div className="grid gap-4">
          {versions.map((v) => (
            <a
              key={v.id}
              href={v.href}
              className="group flex items-center gap-6 p-5 rounded-xl border border-gray-800 hover:border-gray-600 bg-gray-900 hover:bg-gray-800 transition-all"
            >
              {/* Color preview swatch */}
              <div className={`w-20 h-16 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold ${v.preview} border border-gray-700`}>
                HS
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-gray-500 text-xs font-mono">{v.id}</span>
                  <h2 className="text-white font-semibold">{v.name}</h2>
                </div>
                <p className="text-gray-400 text-sm">{v.description}</p>
              </div>

              <span className="text-gray-600 group-hover:text-gray-400 transition-colors text-lg flex-shrink-0">
                →
              </span>
            </a>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-8 font-mono">
          All versions share the same content layer — change copy in{" "}
          <code className="text-gray-500">src/content/site.ts</code>
        </p>
      </div>
    </main>
  );
}
