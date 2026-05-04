import { motion } from 'motion/react';
import { Terminal, Users, Share2 } from 'lucide-react';
import { StepCard } from './StepCard';
import { TerminalMockup } from './TerminalMockup';
import { trackExpertCtaClick } from '../lib/analytics';

const steps = [
  {
    icon: Terminal,
    title: 'Install',
    description:
      'Run a single command to self-host HeySummon on your infrastructure. Or use the built-in Cloudflare tunnel or Tailscale for secure remote access',
  },
  {
    icon: Users,
    title: 'Onboard',
    description:
      'Create your account and connect the channels you already use — Slack, Telegram, the Dashboard, WhatsApp, or Phone. Set up summoning context so AI agents know exactly when to reach you.',
  },
  {
    icon: Share2,
    title: 'Share',
    description:
      'Generate a setup link for each client. The link includes your summoning context — guidelines that tell the AI when to summon you. Clients install the skill and their AI can reach you instantly.',
  },
];

export function ExpertsSection() {
  return (
    <section id="experts" className="py-32 px-4 sm:px-6 lg:px-8">
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
            For Experts
          </div>
          <h2 className="font-serif text-4xl md:text-5xl mb-6">
            You have the expertise. Make it available.
          </h2>
          <p className="text-lg text-text-body max-w-3xl">
            You are the human expert that AI agents reach when they need help. Set up HeySummon on
            your infrastructure and be available on your terms.
          </p>
          <p className="text-base text-text-muted max-w-3xl mt-4 italic">
            Without clear escalation rules, your AI either bothers you constantly or makes expensive
            mistakes silently.
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TerminalMockup title="install heysummon">
              <div className="text-primary">$ npx @heysummon/app</div>
              <div className="text-text-muted mt-2">Setting up HeySummon...</div>
              <div className="text-text-muted mt-1">Creating local database...</div>
              <div className="text-text-muted mt-1">Starting Cloudflare tunnel...</div>
              <div className="text-green-check mt-2">&#10003; HeySummon is running</div>
              <div className="text-text-body mt-1">{"  "}Dashboard: <span className="text-primary">https://your-site.com</span></div>
            </TerminalMockup>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TerminalMockup title="example setup link">
              <div className="text-text-muted"># Your setup link includes context instructions:</div>
              <div className="text-text-body mt-2">
                <span className="text-primary">https://your-site.com</span>
                <span className="text-text-muted">/setup/</span>
                <span className="text-green-check">abc123</span>
              </div>
              <div className="text-text-muted mt-4"># Summoning context (embedded in the link):</div>
              <div className="text-text-body mt-1">
                <span className="text-purple-400">expert</span>: Senior DevOps Engineer
              </div>
              <div className="text-text-body">
                <span className="text-purple-400">available</span>: Mon-Fri, 9am-6pm CET
              </div>
              <div className="text-text-body">
                <span className="text-purple-400">summon_when</span>: Infrastructure decisions,
              </div>
              <div className="text-text-body">
                {"  "}production deployments, security reviews
              </div>
              <div className="text-text-body">
                <span className="text-purple-400">do_not_summon</span>: Routine CI failures,
              </div>
              <div className="text-text-body">
                {"  "}formatting issues, dependency updates
              </div>
            </TerminalMockup>
          </motion.div>
        </div>

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
            onClick={() => trackExpertCtaClick('experts_section')}
            className="inline-flex items-center gap-2 bg-white text-bg-deep px-6 py-3 rounded-full font-semibold hover:bg-text-heading transition-colors"
          >
            Set Up Your Summon Station
          </a>
        </motion.div>
      </div>
    </section>
  );
}
