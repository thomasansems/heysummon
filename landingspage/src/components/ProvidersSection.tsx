import { motion } from 'motion/react';
import { Terminal, Users, Share2 } from 'lucide-react';
import { StepCard } from './StepCard';
import { TerminalMockup } from './TerminalMockup';
import { trackProviderCtaClick } from '../lib/analytics';

const steps = [
  {
    icon: Terminal,
    title: 'Install',
    description:
      'Run npx heysummon or docker compose up. Self-hosted on your infrastructure. Use the built-in Cloudflare tunnel or Tailscale for remote access.',
  },
  {
    icon: Users,
    title: 'Onboard',
    description:
      'Create your account, connect your preferred channels (Slack, Telegram, Dashboard, WhatsApp, Phone). Set up summoning context so AI knows when to reach you.',
  },
  {
    icon: Share2,
    title: 'Share',
    description:
      "Generate a setup link for each client. They install the skill and their AI can summon you. That's it.",
  },
];

export function ProvidersSection() {
  return (
    <section id="providers" className="py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-12"
        >
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            For Providers
          </div>
          <h2 className="font-serif text-4xl md:text-5xl mb-6">
            You have the expertise. Make it available.
          </h2>
          <p className="text-lg text-text-body max-w-3xl">
            You&apos;re the human expert that AI agents reach when they need help. Set up HeySummon
            on your infrastructure and be available on your terms.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {steps.map((step, i) => (
            <StepCard
              key={step.title}
              step={i + 1}
              icon={step.icon}
              title={step.title}
              description={step.description}
              index={i}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <TerminalMockup title="install heysummon">
            <div className="text-primary">$ npx heysummon</div>
            <div className="text-text-muted mt-2">Setting up HeySummon...</div>
            <div className="text-text-muted mt-1">Creating local database...</div>
            <div className="text-text-muted mt-1">Starting Cloudflare tunnel...</div>
            <div className="text-green-check mt-1">&#10003; HeySummon is running at https://your-tunnel.trycloudflare.com</div>
            <div className="text-text-muted mt-2">Open the dashboard to create your account and connect channels.</div>
          </TerminalMockup>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-10 text-center"
        >
          <a
            href="https://docs.heysummon.ai"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackProviderCtaClick('providers_section')}
            className="inline-flex items-center gap-2 bg-white text-bg-deep px-6 py-3 rounded-full font-semibold hover:bg-text-heading transition-colors"
          >
            Set Up Your Summon Station
          </a>
        </motion.div>
      </div>
    </section>
  );
}
