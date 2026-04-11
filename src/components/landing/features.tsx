"use client";

import { motion } from "framer-motion";
import {
  Server,
  MessageSquare,
  Code2,
  Plug,
  Users,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Server,
    title: "Your Data Stays Yours",
    description:
      "Self-host on your infrastructure with one Docker command. Nothing phones home, nothing leaves your network.",
  },
  {
    icon: Plug,
    title: "Platform Agnostic",
    description:
      "No SDK lock-in, no vendor tie. Works with any agent framework, any model, and any notification channel — swap pieces without rewriting your stack.",
  },
  {
    icon: Code2,
    title: "Integrate in Minutes",
    description:
      "One API call to get human input. Works with any agent framework -- Claude Code, Codex, n8n, or any HTTP client.",
  },
  {
    icon: MessageSquare,
    title: "Humans Respond Where They Are",
    description:
      "Dashboard, Telegram, Slack, or phone. No context-switching -- the right human gets notified on the right channel.",
  },
  {
    icon: Users,
    title: "Route to the Right Human",
    description:
      "Smart routing based on availability and channel preferences. The right person sees the request, not everyone.",
  },
  {
    icon: ClipboardList,
    title: "Every Decision Logged",
    description:
      "Full audit trail of every question, answer, and approval. Built for compliance and post-incident review.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-muted/30 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            What makes it different
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Purpose-built for AI agents that need human oversight. No
            compromises on security, privacy, or developer experience.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-primary/30">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
