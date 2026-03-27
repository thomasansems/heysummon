import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { trackWaitlistClick, trackDocsClick } from '../../lib/analytics';

const names = ["Elon", "John Doe", "Thomas", "Pete"];

export function JapaneseHero() {
  const [nameIndex, setNameIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const fullText = names[nameIndex];

      if (!isDeleting) {
        setCurrentText(fullText.substring(0, currentText.length + 1));
        if (currentText === fullText) {
          setTimeout(() => setIsDeleting(true), 1500);
        }
      } else {
        setCurrentText(fullText.substring(0, currentText.length - 1));
        if (currentText === '') {
          setIsDeleting(false);
          setNameIndex((prev) => (prev + 1) % names.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, nameIndex]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-24">
      {/* Placeholder background: deep indigo gradient with ink-wash effect */}
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f23]" />
        {/* Ink wash texture overlay (CSS placeholder for AI art) */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#1a1a2e]/30 to-[#1a1a2e]" />
        {/* Sumo wrestler placeholder area */}
        <div className="absolute right-0 top-1/4 bottom-0 w-1/2 opacity-20">
          <div className="w-full h-full bg-gradient-to-l from-[#dc2626]/10 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[#f59e0b]/20 text-9xl font-serif select-none" aria-hidden="true">
              力
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 text-center max-w-6xl px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-3 px-5 py-2 rounded-full font-mono text-sm text-[#c4b5a0] bg-[#252540]/50 border border-[#f59e0b]/30 backdrop-blur-md mb-10"
        >
          <span>Open Source</span>
          <span className="w-1 h-1 rounded-full bg-[#f59e0b]/50"></span>
          <span>Self-Hosted</span>
          <span className="w-1 h-1 rounded-full bg-[#f59e0b]/50"></span>
          <span>Quick response</span>
        </motion.div>

        <h1 className="text-3xl sm:text-5xl md:text-7xl leading-tight tracking-tight mb-6">
          <span>Hey Summon</span>{' '}
          <span className="inline-block min-w-[2ch] text-left">
            {currentText}<span className="animate-pulse text-[#dc2626]">|</span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-base sm:text-lg md:text-xl text-[#c4b5a0] max-w-2xl mx-auto mb-10"
        >
          A self-hosted, open-source platform that gives your AI agents a direct line to human experts. Install a skill via <code className="text-[#faf5ef] bg-[#252540] px-2 py-1 rounded">npx skill.sh</code>, your agent asks, a human responds, and the workflow continues. Your data never leaves your infrastructure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row justify-center gap-4"
        >
          <a href="https://cloud.heysummon.ai" target="_blank" rel="noopener noreferrer" onClick={() => trackWaitlistClick('hero')} className="btn-crimson px-6 py-3 rounded-full font-semibold flex items-center justify-center gap-2">
            Join Waiting List
          </a>
          <a href="https://docs.heysummon.ai" target="_blank" rel="noopener noreferrer" onClick={() => trackDocsClick('hero')} className="bg-transparent border border-[#f59e0b]/30 text-[#faf5ef] px-6 py-3 rounded-full font-medium hover:bg-[#f59e0b]/5 transition-colors text-center">
            Read the Docs
          </a>
        </motion.div>
      </div>
    </section>
  );
}
