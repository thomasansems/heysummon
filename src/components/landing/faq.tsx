"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "What is HeySummon?",
    answer:
      "HeySummon is a self-hosted human-in-the-loop platform for AI agents. When your AI agent needs human judgment -- an approval, a review, a decision -- it summons the right expert through HeySummon. The expert responds via Slack, CLI, or other channels, and the agent continues.",
  },
  {
    question: "How do I integrate HeySummon with my AI agent?",
    answer:
      "Install the HeySummon SDK, configure your API key, and use a single API call to summon an expert. The SDK handles encryption, routing, and response delivery. Most integrations take under 10 minutes.",
  },
  {
    question: "Is HeySummon really self-hosted?",
    answer:
      "Yes. HeySummon runs entirely on your infrastructure. The server, database, and all communication channels are under your control. No data is sent to external services. You can run it on a single machine or scale across your infrastructure.",
  },
  {
    question: "What AI agents does it work with?",
    answer:
      "HeySummon works with any AI agent that can make HTTP requests. It is agent-agnostic by design. Whether you are building with Claude, GPT, custom agents, or any other AI platform, HeySummon provides the human-in-the-loop layer.",
  },
  {
    question: "What notification channels are supported?",
    answer:
      "Currently Slack and CLI are fully supported, with more channels on the roadmap. You can also build custom channel adapters using our adapter API to integrate with any communication platform your team uses.",
  },
  {
    question: "How is communication secured?",
    answer:
      "HeySummon uses end-to-end encryption with NaCl (TweetNaCl). Messages are encrypted on the agent side and can only be decrypted by the intended expert. The server stores only encrypted payloads and cannot read message contents.",
  },
  {
    question: "Is HeySummon free?",
    answer:
      "HeySummon is open source and free to self-host. You run it on your own infrastructure with no licensing fees. A hosted cloud version is coming soon for teams that prefer a managed solution.",
  },
];

function FaqItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left"
      >
        <span className="pr-4 text-base font-medium">{question}</span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Frequently asked questions
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="border-t border-border"
        >
          {faqs.map((faq, i) => (
            <FaqItem
              key={i}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
