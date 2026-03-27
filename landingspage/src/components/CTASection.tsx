import { motion } from 'motion/react';
import { trackWaitlistClick, trackGithubClick } from '../lib/analytics';

const needs = [
  "Security auditors to harden our E2E encryption",
  "Testers across different AI clients and channels",
  "Contributors to build new integrations",
  "Ideas for features we haven't thought of yet",
];

export function CTASection() {
  return (
    <section className="py-32 px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="font-serif text-4xl md:text-5xl mb-6">
          We're self-hosted because we need you.
        </h2>
        <p className="text-lg text-text-body mb-8 max-w-2xl mx-auto">
          HeySummon is an open-source project with big ambitions and a small team. We're building the infrastructure for human-in-the-loop AI, and we can't do it alone. Whether you write code, break things, or just have strong opinions -- we want you involved.
        </p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="flex flex-wrap justify-center gap-3 mb-10"
        >
          {needs.map((need) => (
            <span key={need} className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-text-body">
              {need}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className="flex justify-center gap-4"
        >
          <a
            href="https://github.com/thomasansems/heysummon"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackGithubClick('cta_section')}
            className="bg-white text-bg-deep px-6 py-3 rounded-full font-semibold hover:bg-text-heading transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            Contribute
          </a>
          <a
            href="https://cloud.heysummon.ai"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackWaitlistClick('cta_section')}
            className="bg-transparent border border-white/20 text-white px-6 py-3 rounded-full font-medium hover:bg-white/5 transition-colors"
          >
            Join Waiting List
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
