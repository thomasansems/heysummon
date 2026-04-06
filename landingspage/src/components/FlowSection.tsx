import { motion } from 'motion/react';
import { AlertCircle, Send, Bell, MessageSquare, CheckCircle2 } from 'lucide-react';

const flowSteps = [
  {
    icon: AlertCircle,
    label: 'AI runs into a hard problem',
  },
  {
    icon: Send,
    label: 'Summons expert via HeySummon',
  },
  {
    icon: Bell,
    label: 'Expert gets notified',
    sublabel: 'Slack / Telegram / Dashboard / Phone',
  },
  {
    icon: MessageSquare,
    label: 'Expert responds',
  },
  {
    icon: CheckCircle2,
    label: 'AI picks up the answer and continues',
  },
];

export function FlowSection() {
  return (
    <section id="flow" className="py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            The Flow
          </div>
          <h2 className="font-serif text-4xl md:text-5xl mb-6">
            One question. One answer. Every channel.
          </h2>
          <p className="text-lg text-text-body max-w-3xl mx-auto">
            Set up the expert side once, then connect unlimited AI agents across any platform
            -- Claude Code, Codex, Cursor, n8n, OpenClaw, or any HTTP client. Every hard question
            flows to one place. Fully self-hosted.
          </p>
        </motion.div>

        {/* Flow diagram */}
        <ol className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 lg:gap-0">
          {flowSteps.map((step, i) => (
            <li key={step.label} className="flex flex-col lg:flex-row items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.15,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                className="flex flex-col items-center text-center w-40"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-sm font-medium text-text-heading leading-snug">
                  {step.label}
                </span>
                {step.sublabel && (
                  <span className="text-xs text-text-muted mt-1">{step.sublabel}</span>
                )}
              </motion.div>

              {/* Arrow between steps */}
              {i < flowSteps.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.15 + 0.1 }}
                  className="text-text-muted mx-2 my-2 lg:my-0"
                >
                  {/* Right arrow on desktop, down arrow on mobile */}
                  <svg
                    className="hidden lg:block w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                  <svg
                    className="lg:hidden w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12l7 7 7-7" />
                  </svg>
                </motion.div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
