"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";

const codeLines = [
  { prefix: "// AI agent needs human approval", color: "text-muted-foreground" },
  { prefix: 'const answer = await heysummon.ask({', color: "text-foreground" },
  { prefix: '  expert: "senior-engineer",', color: "text-primary" },
  { prefix: '  question: "Deploy v2.4 to production?",', color: "text-primary" },
  { prefix: '  context: { diff: "+1,847 -203 lines",', color: "text-muted-foreground" },
  { prefix: '             tests: "147/147 passing" }', color: "text-muted-foreground" },
  { prefix: "});", color: "text-foreground" },
  { prefix: "", color: "" },
  { prefix: '// Expert responds via Slack in 34s', color: "text-muted-foreground" },
  { prefix: 'console.log(answer); // "Approved. Ship it."', color: "text-green-500 dark:text-green-400" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-32">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
              Open Source & Self-Hosted
            </div>

            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              AI does the work.{" "}
              <span className="text-primary">Humans make the calls.</span>
            </h1>

            <p className="mb-8 max-w-lg text-lg text-muted-foreground">
              The self-hosted, platform-agnostic human-in-the-loop API for AI
              agents. One API call to get human input during agent execution —
              works with any framework, any model, any channel.
            </p>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/auth/signup">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a
                  href="https://github.com/thomasansems/heysummon"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  View on GitHub
                </a>
              </Button>
            </div>
          </motion.div>

          {/* Code preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative"
          >
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-400/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                <span className="h-3 w-3 rounded-full bg-green-400/80" />
                <span className="ml-3 text-xs text-muted-foreground">
                  agent.ts
                </span>
              </div>

              {/* Code */}
              <div className="p-5">
                <pre className="font-mono text-sm leading-relaxed">
                  {codeLines.map((line, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }}
                      className={line.color}
                    >
                      {line.prefix || "\u00A0"}
                    </motion.div>
                  ))}
                </pre>
              </div>
            </div>

            {/* Floating notification card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 1.2 }}
              className="absolute -bottom-6 -left-4 rounded-lg border border-border bg-card p-3 shadow-lg md:-left-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="3">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium">Sarah approved</p>
                  <p className="text-[10px] text-muted-foreground">via Slack -- 34s</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
