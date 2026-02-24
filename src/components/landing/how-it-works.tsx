"use client";

import { motion } from "framer-motion";

const steps = [
  {
    number: "01",
    title: "AI Agent calls the API",
    description:
      "Your agent sends a question with full context — the applicant data, risk scores, conversation history. Everything the expert needs to make a decision.",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    number: "02",
    title: "Expert gets notified",
    description:
      "John Doe receives the request on Telegram — instantly. The full context is right there. No digging through email threads. No Slack hunting.",
    accent: "from-cyan-500 to-blue-500",
  },
  {
    number: "03",
    title: "Response flows back",
    description:
      'John types his answer. It flows back to your AI agent as a structured response — ready to act on. Average response time: 47 seconds.',
    accent: "from-emerald-500 to-green-500",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-[family-name:var(--font-dm-sans)] text-3xl md:text-4xl font-bold tracking-tight mb-4">
            How it works
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Three steps. That&apos;s all it takes to connect your AI agent with
            human expertise.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-[60px] left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-violet-500/30 via-cyan-500/30 to-emerald-500/30" />

          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative text-center"
            >
              {/* Step number */}
              <div className="relative inline-flex mb-6">
                <div
                  className={`w-[72px] h-[72px] rounded-2xl bg-gradient-to-br ${step.accent} p-px`}
                >
                  <div className="w-full h-full rounded-2xl bg-zinc-950 flex items-center justify-center">
                    <span className="text-2xl font-bold font-[family-name:var(--font-geist-mono)] text-zinc-200">
                      {step.number}
                    </span>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
