"use client";

import { motion } from "framer-motion";
import { Bot, Route, UserCheck } from "lucide-react";

const steps = [
  {
    icon: Bot,
    step: "01",
    title: "AI hits a decision point",
    description:
      "Your AI agent encounters a moment that needs human judgment -- a deployment, a purchase, a content publish, or any critical decision.",
  },
  {
    icon: Route,
    step: "02",
    title: "HeySummon routes to the right expert",
    description:
      "The request is instantly routed to the right person via Slack, CLI, or other channels. End-to-end encrypted, with full context attached.",
  },
  {
    icon: UserCheck,
    step: "03",
    title: "Expert responds, AI continues",
    description:
      "The expert approves, rejects, or provides guidance. The AI agent picks up right where it left off -- with confidence and a full audit trail.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            How it works
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Three steps between your AI agent&apos;s question and an expert&apos;s answer.
          </p>
        </motion.div>

        <div className="relative grid gap-8 md:grid-cols-3 md:gap-12">
          {/* Connector line (desktop) */}
          <div className="absolute top-12 left-[16.67%] right-[16.67%] hidden h-px bg-border md:block" />

          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="relative text-center"
            >
              <div className="relative z-10 mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                <step.icon className="h-10 w-10 text-primary" />
              </div>
              <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-primary">
                Step {step.step}
              </span>
              <h3 className="mb-3 text-xl font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
