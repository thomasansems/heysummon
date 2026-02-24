"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

function FlowNode({
  label,
  sublabel,
  delay,
  icon,
}: {
  label: string;
  sublabel: string;
  delay: number;
  icon: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="flex flex-col items-center gap-2 shrink-0"
    >
      <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-2xl">
        {icon}
      </div>
      <div className="text-center">
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500">{sublabel}</div>
      </div>
    </motion.div>
  );
}

function FlowArrow({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0 }}
      animate={{ opacity: 1, scaleX: 1 }}
      transition={{ duration: 0.4, delay }}
      className="flex-1 flex items-center min-w-[60px] max-w-[120px] -mt-5"
    >
      <div className="h-px w-full bg-zinc-700 relative">
        <motion.div
          className="absolute top-[-3px] w-[7px] h-[7px] rounded-full bg-violet-400 shadow-[0_0_8px_2px_rgba(139,92,246,0.4)]"
          animate={{ left: ["0%", "100%"] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "linear",
            delay: delay + 0.5,
          }}
        />
        <div className="absolute right-0 top-[-4px] border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[7px] border-l-zinc-700" />
      </div>
    </motion.div>
  );
}

function HeroCodeSnippet() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 backdrop-blur-sm overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/50">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-zinc-800" />
          <div className="w-3 h-3 rounded-full bg-zinc-800" />
          <div className="w-3 h-3 rounded-full bg-zinc-800" />
        </div>
        <span className="text-xs text-zinc-500 ml-2">index.ts</span>
      </div>
      <div className="p-5 text-[13px] font-[family-name:var(--font-geist-mono)] leading-relaxed overflow-x-auto">
        <div>
          <span className="text-violet-400">import</span>
          <span className="text-zinc-200"> HeySummon </span>
          <span className="text-violet-400">from</span>
          <span className="text-emerald-400"> &apos;@heysummon/sdk&apos;</span>
          <span className="text-zinc-500">;</span>
        </div>
        <div className="h-5" />
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
        <div className="h-5" />
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
            &quot;Should we approve this loan?&quot;
          </span>
          <span className="text-zinc-400">,</span>
        </div>
        <div className="pl-4">
          <span className="text-zinc-200">context</span>
          <span className="text-zinc-400">{": { "}</span>
          <span className="text-zinc-200">riskScore</span>
          <span className="text-zinc-400">: </span>
          <span className="text-amber-400">0.73</span>
          <span className="text-zinc-400">{" },"}</span>
        </div>
        <div className="pl-4">
          <span className="text-zinc-200">priority</span>
          <span className="text-zinc-400">: </span>
          <span className="text-emerald-400">&quot;high&quot;</span>
        </div>
        <div>
          <span className="text-zinc-400">{"});"}</span>
        </div>
        <div className="h-5" />
        <div>
          <span className="text-zinc-600">{"// → "}</span>
          <span className="text-emerald-400/70">
            &quot;Approve with conditions: verify income&quot;
          </span>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-16">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-500/[0.07] rounded-full blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Text */}
          <div>
            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-1.5 mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-zinc-400">
                Human-in-the-Loop as a Service
              </span>
            </motion.div>

            <motion.h1
              {...fadeUp}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-[family-name:var(--font-dm-sans)] text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6"
            >
              When AI needs a human.{" "}
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
                One API call away.
              </span>
            </motion.h1>

            <motion.p
              {...fadeUp}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-zinc-400 mb-8 max-w-lg leading-relaxed"
            >
              Your AI agents call our API when they need human expertise. We
              route the request to the right expert. They respond. Your agent
              keeps going.
            </motion.p>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap items-center gap-4"
            >
              <Link
                href="/auth/signup"
                className="rounded-full bg-white text-zinc-900 px-6 py-3 text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Get Started Free
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-300 hover:bg-zinc-900 transition-colors"
              >
                How it works
              </a>
            </motion.div>
          </div>

          {/* Right: Code snippet */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <HeroCodeSnippet />
          </motion.div>
        </div>

        {/* Flow visualization */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-24 rounded-2xl border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-sm p-8 md:p-12"
        >
          <p className="text-center text-xs text-zinc-500 uppercase tracking-widest mb-8">
            Request Flow
          </p>
          <div className="flex items-start justify-center gap-3 sm:gap-4 overflow-x-auto pb-2">
            <FlowNode
              icon="🤖"
              label="AI Agent"
              sublabel="Needs help"
              delay={0.8}
            />
            <FlowArrow delay={1.0} />
            <FlowNode
              icon="⚡"
              label="HeySummon"
              sublabel="Routes request"
              delay={1.2}
            />
            <FlowArrow delay={1.4} />
            <FlowNode
              icon="👤"
              label="John Doe"
              sublabel="Via Telegram"
              delay={1.6}
            />
            <FlowArrow delay={1.8} />
            <FlowNode
              icon="✅"
              label="AI Agent"
              sublabel="Gets answer"
              delay={2.0}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
