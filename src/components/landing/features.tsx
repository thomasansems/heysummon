"use client";

import { motion } from "framer-motion";
import {
  Server,
  MessageSquare,
  Code2,
  Lock,
  Users,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Server,
    title: "Self-Hosted",
    description:
      "Runs on your infrastructure. Your data never leaves your servers. Full control over every byte.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Channel",
    description:
      "Reach experts where they already are -- Slack, CLI, or build your own channel adapter.",
  },
  {
    icon: Code2,
    title: "Simple SDK",
    description:
      "One API call to summon an expert. Integrate in minutes with our lightweight TypeScript SDK.",
  },
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    description:
      "Messages encrypted from agent to expert using NaCl. Even the HeySummon server cannot read them.",
  },
  {
    icon: Users,
    title: "Smart Routing",
    description:
      "Route requests to the right expert based on availability, expertise, and channel preferences.",
  },
  {
    icon: ClipboardList,
    title: "Full Audit Trail",
    description:
      "Every question, every answer, every decision -- logged and auditable for compliance and review.",
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
            Everything you need for human-in-the-loop
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Purpose-built for AI agents that need expert approval. No
            compromises on security or developer experience.
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
