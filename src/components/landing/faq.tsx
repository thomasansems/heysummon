"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "What is HeySummon?",
    answer:
      "HeySummon is a Human-in-the-Loop API for AI agents. When your AI agent encounters a situation that needs human judgment — like approving a loan, reviewing a document, or making a subjective decision — it calls our API. We route the request to the right human expert, who responds, and the answer flows back to your agent.",
  },
  {
    question: "How does it work with my AI agent?",
    answer:
      "It's a single API call. Your agent sends a question with context (using our TypeScript or Python SDK, or REST API). HeySummon routes it to the assigned expert via their preferred channel (Telegram, dashboard, etc.). The expert responds, and the structured answer is returned to your agent. Average response time is under 60 seconds.",
  },
  {
    question: "Is it secure?",
    answer:
      "Yes. All messages are encrypted end-to-end by default. HeySummon operates on a zero-knowledge architecture — we can't read your requests or responses. API keys support fine-grained scoping, and we provide a full audit trail for compliance.",
  },
  {
    question: "What channels are supported?",
    answer:
      "Currently we support Telegram and the HeySummon Dashboard. WhatsApp, Slack, and email are on our roadmap. Experts choose their preferred channel, and you can configure fallback channels for time-sensitive requests.",
  },
  {
    question: "Can I self-host HeySummon?",
    answer:
      "Yes, on our Enterprise plan. We offer a self-hosted option for organizations that need full control over their data and infrastructure. Contact our sales team for details on deployment options.",
  },
];

function FaqItem({
  question,
  answer,
  index,
}: {
  question: string;
  answer: string;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border-b border-zinc-800/50"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
      >
        <span className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors pr-4">
          {question}
        </span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-zinc-500 shrink-0"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-sm text-zinc-400 leading-relaxed pb-5">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function Faq() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="font-[family-name:var(--font-dm-sans)] text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Frequently asked questions
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto">
          {faqs.map((faq, i) => (
            <FaqItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              index={i}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
