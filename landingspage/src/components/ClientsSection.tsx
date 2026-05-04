import { motion } from 'motion/react';
import { Link, Terminal } from 'lucide-react';
import { TerminalMockup } from './TerminalMockup';
import { trackClientCtaClick } from '../lib/analytics';

const options = [
  {
    icon: Link,
    title: 'Option A: Get a link from your expert',
    description:
      'Your expert shares a setup link with you. Open it, review the summoning guidelines and context instructions, and you are connected. The link tells your AI when and how to summon the expert.',
  },
  {
    icon: Terminal,
    title: 'Option B: Install the skill via npm',
    description:
      'Run npx skill.sh heysummon and it will guide you through the process of connecting to an expert. You will be prompted to enter the expert URL and verify the connection.',
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
            Two ways to connect your AI agent to a human expert. Pick whichever works for you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {options.map((option, i) => (
            <motion.div
              key={option.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors duration-500"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <option.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-text-heading mb-3">{option.title}</h3>
              <p className="text-text-body leading-relaxed">{option.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TerminalMockup title="install skill">
              <div className="text-text-muted">Enter npx skill</div>
              <div className="text-primary mt-1">$ npx skill.sh install heysummon</div>
              <div className="text-text-muted mt-2">Installing HeySummon skill...</div>
              <div className="text-green-check mt-1">&#10003; Skill installed successfully</div>
              <div className="text-text-body mt-2">Your expert is now able to help.</div>
            </TerminalMockup>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <TerminalMockup title="install skill">
              <div className="text-text-muted">Enter expert URL or setup link:</div>
              <div className="text-text-body mt-1">{'>'} <span className="text-primary">https://your-site.com/setup/abc123</span></div>
              <div className="text-text-muted mt-2">Verifying connection...</div>
              <div className="text-green-check mt-1">&#10003; Connected to: Senior DevOps Engineer</div>
              <div className="text-text-body mt-2">Your AI agent can now summon a human expert.</div>
            </TerminalMockup>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4"
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
          <span className="text-text-muted text-sm">
            No expert yet?{' '}
            <a
              href="https://discord.gg/heysummon"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Join our Discord
            </a>
            {' '}— someone might be willing to help.
          </span>
        </motion.div>
      </div>
    </section>
  );
}
