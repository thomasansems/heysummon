"use client";

import { motion } from "framer-motion";
import { Rocket, Code, Megaphone, Shield } from "lucide-react";

const useCases = [
  {
    icon: Rocket,
    title: "Deployment Approvals",
    scenario: '"Deploy v2.4 to production?"',
    agent: "CI/CD Agent",
    expert: "Senior Engineer",
    channel: "Slack",
    responseTime: "34s",
    description:
      "Your deployment agent runs tests, builds artifacts, and asks the right engineer to approve before going live.",
  },
  {
    icon: Code,
    title: "Code Review Decisions",
    scenario: '"Merge this refactor of the auth module?"',
    agent: "Coding Assistant",
    expert: "Tech Lead",
    channel: "CLI",
    responseTime: "2m",
    description:
      "AI coding assistants can flag complex changes and get human sign-off before merging into protected branches.",
  },
  {
    icon: Megaphone,
    title: "Content Sign-Off",
    scenario: '"Publish this blog post about our Q1 results?"',
    agent: "Marketing Agent",
    expert: "Marketing Director",
    channel: "Slack",
    responseTime: "15m",
    description:
      "AI content generators draft, polish, and then route final approval to the right stakeholder before publishing.",
  },
  {
    icon: Shield,
    title: "Security Decisions",
    scenario: '"Allow this IP range access to the staging API?"',
    agent: "Infrastructure Agent",
    expert: "Security Engineer",
    channel: "Slack",
    responseTime: "1m",
    description:
      "Infrastructure automation can request human judgment for access control, firewall rules, and policy changes.",
  },
];

export function UseCasesSection() {
  return (
    <section id="use-cases" className="py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Built for real AI workflows
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Any AI agent, any decision that needs human judgment. Here are some
            common patterns.
          </p>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="group rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <uc.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {uc.responseTime}
                </span>
              </div>

              <h3 className="mb-2 text-lg font-semibold">{uc.title}</h3>

              <div className="mb-4 rounded-lg bg-muted/50 px-3 py-2 font-mono text-sm text-primary">
                {uc.scenario}
              </div>

              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                {uc.description}
              </p>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-md border border-border px-2 py-0.5">
                  {uc.agent}
                </span>
                <span className="text-muted-foreground/50">&rarr;</span>
                <span className="rounded-md border border-border px-2 py-0.5">
                  {uc.expert}
                </span>
                <span className="text-muted-foreground/50">via</span>
                <span className="rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-primary">
                  {uc.channel}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
