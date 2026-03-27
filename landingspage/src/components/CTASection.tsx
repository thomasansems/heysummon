import { motion } from 'motion/react';

export function CTASection() {
  return (
    <section className="py-32 px-8">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="font-serif text-4xl md:text-5xl mb-6">
          Ready to bring humans into the loop?
        </h2>
        <p className="text-lg text-text-body mb-10 max-w-2xl mx-auto">
          Join the waiting list for HeySummon Cloud and be among the first to give your AI agents a direct line to human expertise.
        </p>
        <div className="flex justify-center gap-4">
          <a
            href="https://cloud.heysummon.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white text-bg-deep px-6 py-3 rounded-full font-semibold hover:bg-text-heading transition-colors"
          >
            Join Waiting List
          </a>
          <a
            href="https://docs.heysummon.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-transparent border border-white/20 text-white px-6 py-3 rounded-full font-medium hover:bg-white/5 transition-colors"
          >
            Self-Host Instead
          </a>
        </div>
      </motion.div>
    </section>
  );
}
