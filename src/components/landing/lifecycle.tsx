"use client";

import { motion } from "framer-motion";

const stages = [
  {
    status: "Created",
    time: "0ms",
    color: "bg-zinc-400",
    detail: "AI agent sends request",
  },
  {
    status: "Routed",
    time: "12ms",
    color: "bg-blue-400",
    detail: "Matched to John Doe",
  },
  {
    status: "Notified",
    time: "45ms",
    color: "bg-violet-400",
    detail: "Sent via Telegram",
  },
  {
    status: "Responded",
    time: "47s",
    color: "bg-emerald-400",
    detail: "Expert answered",
  },
  {
    status: "Delivered",
    time: "47.2s",
    color: "bg-emerald-400",
    detail: "Response sent to agent",
  },
];

export function Lifecycle() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="font-[family-name:var(--font-dm-sans)] text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Request Lifecycle Visibility
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Track every request from creation to delivery. Full observability
            into your human-in-the-loop pipeline.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-6 md:p-10 max-w-3xl mx-auto"
        >
          {/* Request header */}
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-lg bg-zinc-800 text-xs font-[family-name:var(--font-geist-mono)] text-zinc-300">
                HS-7291
              </div>
              <span className="text-sm text-zinc-400">
                &quot;Should we approve this loan application?&quot;
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-emerald-400">Delivered</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-0">
            {stages.map((stage, i) => (
              <motion.div
                key={stage.status}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.1 }}
                className="flex items-start gap-4 relative"
              >
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full ${stage.color} shrink-0 mt-1 ring-4 ring-zinc-900/80`}
                  />
                  {i < stages.length - 1 && (
                    <div className="w-px h-8 bg-zinc-800" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex items-center justify-between pb-5">
                  <div>
                    <span className="text-sm font-medium text-zinc-200">
                      {stage.status}
                    </span>
                    <span className="text-xs text-zinc-500 ml-3">
                      {stage.detail}
                    </span>
                  </div>
                  <span className="text-xs font-[family-name:var(--font-geist-mono)] text-zinc-600">
                    +{stage.time}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Response time */}
          <div className="mt-4 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Provider: John Doe via Telegram
            </span>
            <span className="text-xs text-zinc-400">
              Total response time:{" "}
              <span className="text-emerald-400 font-medium">47 seconds</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
