"use client";

import { motion } from "framer-motion";

const problems = [
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
    ),
    title: "Context Lost",
    description:
      "Email threads and Slack DMs lose the AI context. By the time an expert responds, they're missing half the picture.",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Slow Response",
    description:
      "Slack DMs get buried. Emails go unread. Experts respond hours — sometimes days — later. Your AI agent is stuck waiting.",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
        />
      </svg>
    ),
    title: "No Audit Trail",
    description:
      "Who answered what? When? No structured history. Compliance teams hate it. Debugging is impossible.",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M11.42 15.17l-5.1-3.26a1.5 1.5 0 010-2.56l5.1-3.26a1.5 1.5 0 011.639.058l4.928 3.49a1.5 1.5 0 010 2.448l-4.928 3.49a1.5 1.5 0 01-1.64.058z"
        />
      </svg>
    ),
    title: "Integration Pain",
    description:
      "Custom webhooks for every AI system. Bespoke integrations that break. A new Slack bot for every team.",
  },
];

export function Problem() {
  return (
    <section className="relative py-24 md:py-32">
      {/* Subtle separator */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-[family-name:var(--font-dm-sans)] text-3xl md:text-4xl font-bold tracking-tight mb-4">
            The problem with manual escalation
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            When AI agents need humans today, it&apos;s a mess of emails, Slack
            threads, and lost context.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {problems.map((problem, i) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-6 hover:border-red-500/20 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 mb-4">
                {problem.icon}
              </div>
              <h3 className="text-base font-semibold mb-2">{problem.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {problem.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
