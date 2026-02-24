"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Language = "typescript" | "python" | "curl";

const tabs: { id: Language; label: string }[] = [
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "curl", label: "cURL" },
];

function TypeScriptCode() {
  return (
    <>
      <div>
        <span className="text-violet-400">import</span>
        <span className="text-zinc-200"> HeySummon </span>
        <span className="text-violet-400">from</span>
        <span className="text-emerald-400"> &apos;@heysummon/sdk&apos;</span>
        <span className="text-zinc-500">;</span>
      </div>
      <div className="h-4" />
      <div>
        <span className="text-violet-400">const </span>
        <span className="text-zinc-200">client </span>
        <span className="text-violet-400">= new </span>
        <span className="text-cyan-400">HeySummon</span>
        <span className="text-zinc-400">{"({ "}</span>
        <span className="text-zinc-200">apiKey</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">&apos;hs_...&apos;</span>
        <span className="text-zinc-400">{" });"}</span>
      </div>
      <div className="h-4" />
      <div>
        <span className="text-violet-400">const </span>
        <span className="text-zinc-200">response </span>
        <span className="text-violet-400">= await </span>
        <span className="text-zinc-200">client</span>
        <span className="text-zinc-400">.</span>
        <span className="text-cyan-400">help</span>
        <span className="text-zinc-400">{"({"}</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">question</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">
          &quot;Is this transaction fraudulent?&quot;
        </span>
        <span className="text-zinc-400">,</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">context</span>
        <span className="text-zinc-400">{": { "}</span>
        <span className="text-zinc-200">amount</span>
        <span className="text-zinc-400">: </span>
        <span className="text-amber-400">4200</span>
        <span className="text-zinc-400">, </span>
        <span className="text-zinc-200">country</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">&quot;NG&quot;</span>
        <span className="text-zinc-400">{" },"}</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">provider</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">&quot;john-doe&quot;</span>
      </div>
      <div>
        <span className="text-zinc-400">{"});"}</span>
      </div>
    </>
  );
}

function PythonCode() {
  return (
    <>
      <div>
        <span className="text-violet-400">from</span>
        <span className="text-zinc-200"> heysummon </span>
        <span className="text-violet-400">import</span>
        <span className="text-cyan-400"> HeySummon</span>
      </div>
      <div className="h-4" />
      <div>
        <span className="text-zinc-200">client </span>
        <span className="text-violet-400">= </span>
        <span className="text-cyan-400">HeySummon</span>
        <span className="text-zinc-400">(</span>
        <span className="text-zinc-200">api_key</span>
        <span className="text-violet-400">=</span>
        <span className="text-emerald-400">&quot;hs_...&quot;</span>
        <span className="text-zinc-400">)</span>
      </div>
      <div className="h-4" />
      <div>
        <span className="text-zinc-200">response </span>
        <span className="text-violet-400">= </span>
        <span className="text-zinc-200">client</span>
        <span className="text-zinc-400">.</span>
        <span className="text-cyan-400">help</span>
        <span className="text-zinc-400">(</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">question</span>
        <span className="text-violet-400">=</span>
        <span className="text-emerald-400">
          &quot;Is this transaction fraudulent?&quot;
        </span>
        <span className="text-zinc-400">,</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">context</span>
        <span className="text-violet-400">=</span>
        <span className="text-zinc-400">{"{"}</span>
        <span className="text-emerald-400">&quot;amount&quot;</span>
        <span className="text-zinc-400">: </span>
        <span className="text-amber-400">4200</span>
        <span className="text-zinc-400">, </span>
        <span className="text-emerald-400">&quot;country&quot;</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">&quot;NG&quot;</span>
        <span className="text-zinc-400">{"}"}</span>
        <span className="text-zinc-400">,</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">provider</span>
        <span className="text-violet-400">=</span>
        <span className="text-emerald-400">&quot;john-doe&quot;</span>
      </div>
      <div>
        <span className="text-zinc-400">)</span>
      </div>
    </>
  );
}

function CurlCode() {
  return (
    <>
      <div>
        <span className="text-cyan-400">curl</span>
        <span className="text-zinc-200"> -X POST </span>
        <span className="text-emerald-400">
          https://api.heysummon.com/v1/help
        </span>
        <span className="text-zinc-200"> \</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">-H </span>
        <span className="text-emerald-400">
          &quot;Authorization: Bearer hs_...&quot;
        </span>
        <span className="text-zinc-200"> \</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">-H </span>
        <span className="text-emerald-400">
          &quot;Content-Type: application/json&quot;
        </span>
        <span className="text-zinc-200"> \</span>
      </div>
      <div className="pl-4">
        <span className="text-zinc-200">-d </span>
        <span className="text-emerald-400">&apos;{"{"}</span>
      </div>
      <div className="pl-8">
        <span className="text-cyan-400">&quot;question&quot;</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">
          &quot;Is this transaction fraudulent?&quot;
        </span>
        <span className="text-zinc-400">,</span>
      </div>
      <div className="pl-8">
        <span className="text-cyan-400">&quot;context&quot;</span>
        <span className="text-zinc-400">{": { "}</span>
        <span className="text-cyan-400">&quot;amount&quot;</span>
        <span className="text-zinc-400">: </span>
        <span className="text-amber-400">4200</span>
        <span className="text-zinc-400">{" },"}</span>
      </div>
      <div className="pl-8">
        <span className="text-cyan-400">&quot;provider&quot;</span>
        <span className="text-zinc-400">: </span>
        <span className="text-emerald-400">&quot;john-doe&quot;</span>
      </div>
      <div className="pl-4">
        <span className="text-emerald-400">{"}"}&apos;</span>
      </div>
    </>
  );
}

const codeComponents: Record<Language, React.FC> = {
  typescript: TypeScriptCode,
  python: PythonCode,
  curl: CurlCode,
};

const fileNames: Record<Language, string> = {
  typescript: "index.ts",
  python: "main.py",
  curl: "terminal",
};

export function CodeExamples() {
  const [active, setActive] = useState<Language>("typescript");
  const ActiveCode = codeComponents[active];

  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-[family-name:var(--font-dm-sans)] text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Works with any stack
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Native SDKs for TypeScript and Python. Or just use the REST API
            directly.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 overflow-hidden">
            {/* Tab bar + file name */}
            <div className="border-b border-zinc-800/50">
              <div className="flex items-center justify-between px-4 pt-3">
                <div className="flex gap-1">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActive(tab.id)}
                      className={`relative px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                        active === tab.id
                          ? "text-white bg-zinc-800/50"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {tab.label}
                      {active === tab.id && (
                        <motion.div
                          layoutId="activeTab"
                          className="absolute bottom-0 left-0 right-0 h-px bg-violet-400"
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-zinc-600">
                  {fileNames[active]}
                </span>
              </div>
            </div>

            {/* Code area */}
            <div className="p-5 text-[13px] font-[family-name:var(--font-geist-mono)] leading-relaxed overflow-x-auto min-h-[260px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                >
                  <ActiveCode />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
