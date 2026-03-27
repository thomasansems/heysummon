import { useState } from 'react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'motion/react';

export function Navbar() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 50);
  });

  return (
    <motion.div
      className="fixed z-50 flex justify-center w-full transition-all duration-300"
      initial={{ top: 24 }}
      animate={{
        top: scrolled ? 0 : 24,
        padding: scrolled ? "0" : "0 24px"
      }}
    >
      <motion.nav
        className="flex items-center justify-between bg-bg-deep/80 backdrop-blur-xl border border-white/10 overflow-hidden w-full max-w-[800px]"
        animate={{
          maxWidth: scrolled ? "100%" : "800px",
          borderRadius: scrolled ? "0px" : "9999px",
          padding: scrolled ? "16px 32px" : "12px 24px"
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="flex items-center">
          <img src="/logo.png" alt="HeySummon Logo" className="h-8 w-auto" />
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-text-body">
          <a href="#skill" className="hover:text-text-heading transition-colors">Skill</a>
          <a href="#frameworks" className="hover:text-text-heading transition-colors">Integrations</a>
          <a href="#security" className="hover:text-text-heading transition-colors">Security</a>
          <a href="https://github.com/thomasansems/heysummon" target="_blank" rel="noopener noreferrer" className="hover:text-text-heading transition-colors flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://cloud.heysummon.ai" target="_blank" rel="noopener noreferrer" className="bg-white text-bg-deep px-4 py-2 rounded-full text-sm font-semibold hover:bg-text-heading transition-colors">
            Join Waiting List
          </a>
          <button
            className="md:hidden flex items-center justify-center w-8 h-8 text-text-body hover:text-text-heading transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              ) : (
                <><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="16" x2="20" y2="16" /></>
              )}
            </svg>
          </button>
        </div>
      </motion.nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="md:hidden absolute top-full left-0 right-0 mt-2 mx-4 bg-bg-deep/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-4 text-sm text-text-body"
          >
            <a href="#skill" onClick={() => setMobileOpen(false)} className="hover:text-text-heading transition-colors px-3 py-2">Skill</a>
            <a href="#frameworks" onClick={() => setMobileOpen(false)} className="hover:text-text-heading transition-colors px-3 py-2">Integrations</a>
            <a href="#security" onClick={() => setMobileOpen(false)} className="hover:text-text-heading transition-colors px-3 py-2">Security</a>
            <a href="https://github.com/thomasansems/heysummon" target="_blank" rel="noopener noreferrer" className="hover:text-text-heading transition-colors px-3 py-2 flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
              GitHub
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
