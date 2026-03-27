import { useState, useEffect } from 'react';
import { motion } from 'motion/react';

const names = ["Elon", "John Doe", "Thomas", "Pete"];

export function Hero() {
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
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img src="https://images.pexels.com/photos/796217/pexels-photo-796217.jpeg?auto=compress&cs=tinysrgb&w=1920" alt="Background" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/40 via-bg-deep/50 to-bg-deep/100" />
      </div>

      <div className="relative z-10 text-center max-w-6xl px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-3 px-5 py-2 rounded-full font-mono text-sm text-text-body bg-white/5 border border-white/10 backdrop-blur-md mb-10"
        >
          <span>Open Source</span>
          <span className="w-1 h-1 rounded-full bg-white/50"></span>
          <span>Self-Hosted</span>
          <span className="w-1 h-1 rounded-full bg-white/50"></span>
          <span>Quick response</span>
        </motion.div>

        <h1 className="font-serif text-5xl md:text-7xl leading-tight tracking-tight mb-6 whitespace-nowrap">
          <span>Hey Summon</span>{' '}
          <span className="inline-block min-w-[150px] text-left">
            {currentText}<span className="animate-pulse">|</span>
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-xl text-text-body max-w-2xl mx-auto mb-10"
        >
          Easily install a skill via the <code className="text-white bg-white/10 px-2 py-1 rounded">npx skill.sh</code> framework. Your agent asks, a human responds, and the workflow continues.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex justify-center gap-4"
        >
          <a href="https://cloud.heysummon.ai" target="_blank" rel="noopener noreferrer" className="bg-white text-bg-deep px-6 py-3 rounded-full font-semibold hover:bg-text-heading transition-colors flex items-center gap-2">
            Join Waiting List
          </a>
          <a href="https://docs.heysummon.ai" target="_blank" rel="noopener noreferrer" className="bg-transparent border border-white/20 text-white px-6 py-3 rounded-full font-medium hover:bg-white/5 transition-colors">
            Read the Docs
          </a>
        </motion.div>
      </div>
    </section>
  );
}
