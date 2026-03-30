import { motion } from 'motion/react';
import { trackHeroCtaClick } from '../lib/analytics';

export function Hero() {
  const handleCtaClick = (audience: 'provider' | 'client') => {
    trackHeroCtaClick(audience);
    document.getElementById(audience === 'provider' ? 'providers' : 'clients')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img src="/sumo.jpg" alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/10 via-bg-deep/60 to-bg-deep/100" />
      </div>

      <div className="relative z-10 text-center max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-3 px-5 py-2 rounded-full font-mono text-sm text-text-body bg-white/5 border border-white/10 backdrop-blur-md mb-10"
        >
          <span>Open Source</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>Self-Hosted</span>
          <span className="w-1 h-1 rounded-full bg-white/50" />
          <span>End-to-End Encrypted</span>
        </motion.div>

        {/* Headline */}
        <h1 className="font-serif text-3xl sm:text-5xl md:text-7xl leading-tight tracking-tight mb-6">
          AI does the work.
          <br />
          <span className="italic">Humans make the calls.</span>
        </h1>

        {/* Subline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-text-body max-w-2xl mx-auto mb-10"
        >
          HeySummon connects your AI agents to human experts -- self-hosted, encrypted, and under
          your control. Whether you&apos;re the expert or you need one.
        </motion.p>

        {/* Video placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl aspect-video max-w-4xl mx-auto mb-10 group cursor-pointer"
          aria-label="Product demo video - coming soon"
        >
          <div className="absolute inset-0 bg-bg-card">
            <img
              src="/sumo.jpg"
              alt=""
              className="w-full h-full object-cover opacity-40"
            />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-bg-deep/50 group-hover:bg-bg-deep/40 transition-colors duration-500 z-10">
            <motion.div
              whileHover={{ scale: 1.15 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary backdrop-blur-md border border-primary/30"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </motion.div>
          </div>
        </motion.div>

        {/* Dual CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          <button
            onClick={() => handleCtaClick('provider')}
            className="bg-white text-bg-deep px-6 py-3 rounded-full font-semibold hover:bg-text-heading transition-colors"
          >
            I&apos;m a Provider
          </button>
          <button
            onClick={() => handleCtaClick('client')}
            className="bg-transparent border border-white/20 text-white px-6 py-3 rounded-full font-medium hover:bg-white/5 transition-colors"
          >
            I&apos;m a Client
          </button>
        </motion.div>
      </div>
    </section>
  );
}
