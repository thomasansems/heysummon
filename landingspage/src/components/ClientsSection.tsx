import { motion } from 'motion/react';
import { Link, Download } from 'lucide-react';
import { StepCard } from './StepCard';
import { TerminalMockup } from './TerminalMockup';
import { trackClientCtaClick } from '../lib/analytics';

const steps = [
  {
    icon: Link,
    title: 'Get your link',
    description:
      'Your provider shares a setup link. Open it and verify the summoning guidelines.',
  },
  {
    icon: Download,
    title: 'Install the skill',
    description:
      'Run npx skill.sh heysummon. Done. Your AI agent now has a direct line to a human expert.',
  },
];

export function ClientsSection() {
  return (
    <section id="clients" className="py-32 px-4 sm:px-6 lg:px-8">
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
            For Clients
          </div>
          <h2 className="font-serif text-4xl md:text-5xl mb-6">
            Connect your AI in seconds.
          </h2>
          <p className="text-lg text-text-body max-w-3xl">
            Your provider gives you a setup link. You run one command. Your AI can now summon a
            human expert when it gets stuck.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
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
          <TerminalMockup title="install skill">
            <div className="text-primary">$ npx skill.sh install heysummon</div>
            <div className="text-text-muted mt-2">Installing HeySummon skill...</div>
            <div className="text-green-check mt-1">&#10003; Skill installed successfully</div>
            <div className="text-text-muted mt-2">Your AI agent can now summon a human expert.</div>
            <div className="text-text-muted mt-1">Try it: summon.ask({'{'} question: &quot;Should I deploy?&quot; {'}'})</div>
          </TerminalMockup>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-10 text-center"
        >
          <button
            onClick={() => {
              trackClientCtaClick('clients_section');
              document.getElementById('flow')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="inline-flex items-center gap-2 bg-transparent border border-white/20 text-white px-6 py-3 rounded-full font-medium hover:bg-white/5 transition-colors"
          >
            See How It Works
          </button>
        </motion.div>
      </div>
    </section>
  );
}
