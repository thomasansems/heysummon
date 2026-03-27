import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronDown } from 'lucide-react';

const skills = [
  {
    title: "Install with npm in seconds",
    content: "Run npx skill.sh to instantly add human-in-the-loop capabilities to your project. No complex setup required."
  },
  {
    title: "Type-safe TypeScript with autocompletion",
    content: "Enjoy full type safety and IDE autocompletion out of the box. Catch errors before they hit production."
  },
  {
    title: "Async/await — zero callbacks",
    content: "Our skill uses modern async/await patterns. Just await the human response and continue your workflow seamlessly."
  },
  {
    title: "Works with any AI framework",
    content: "Whether you use LangChain, OpenAI, or custom agents, our skill integrates flawlessly."
  }
];

export function JapaneseSkillSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <section id="skill" className="py-32 px-8 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#8a7d6e] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]"></span>
              Skill
            </div>
            <h2 className="text-4xl md:text-5xl mb-6">One call. One answer.<br/>Every channel.</h2>
            <p className="text-lg text-[#c4b5a0] mb-8">
              Import the skill, ask a question, get an answer. Your AI agent pauses, a human expert responds via their preferred channel, and the workflow continues.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="wooden-plaque rounded-2xl p-8 backdrop-blur-xl"
          >
            <h3 className="text-2xl mb-2">HeySummon Skill</h3>
            <p className="text-[#c4b5a0] mb-6 text-sm">Easily install a skill via the <code className="text-[#dc2626]">npx skill.sh</code> framework.</p>

            <div className="space-y-4">
              {skills.map((skill, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: "easeOut" }}
                  className="border border-[#f59e0b]/10 rounded-xl overflow-hidden bg-[#1a1a2e]/30"
                >
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-[#f59e0b]/5 transition-colors duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-5 h-5 transition-colors duration-300 ${expandedIndex === index ? 'text-[#f59e0b]' : 'text-[#8a7d6e]'}`} />
                      <span className={`font-medium transition-colors duration-300 ${expandedIndex === index ? 'text-[#faf5ef]' : 'text-[#c4b5a0]'}`}>
                        {skill.title}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#8a7d6e] transition-transform duration-300 ${expandedIndex === index ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 pt-0 pl-12 text-sm text-[#c4b5a0]">
                          {skill.content}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Scroll container with terminal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative rounded-2xl overflow-hidden min-h-[350px] md:min-h-[500px] border border-[#f59e0b]/20"
        >
          {/* Scroll-container placeholder background */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#16213e] to-[#1a1a2e]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/50 to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute bottom-0 left-0 right-0 p-8"
          >
            <div className="bg-[#0d0d0d]/80 backdrop-blur-xl border border-[#f59e0b]/20 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#f59e0b]/10 bg-[#252540]/50">
                <div className="w-2.5 h-2.5 rounded-full bg-[#dc2626]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#34d399]"></div>
                <span className="text-xs font-mono text-[#8a7d6e] ml-2">terminal</span>
              </div>
              <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto">
                <div className="text-[#dc2626]">$ npx skill.sh install heysummon</div>
                <div className="text-[#8a7d6e] mt-2">Installing HeySummon skill...</div>
                <div className="text-[#34d399] mt-1">&#10003; Skill installed successfully</div>
                <div className="mt-4 text-[#c4b5a0]">
                  <span className="text-purple-400">import</span> {'{'} summon {'}'} <span className="text-purple-400">from</span> <span className="text-green-300">'heysummon'</span>;<br/><br/>
                  <span className="text-purple-400">const</span> answer = <span className="text-purple-400">await</span> summon.ask({'{'}<br/>
                  &nbsp;&nbsp;provider: <span className="text-green-300">'senior-engineer'</span>,<br/>
                  &nbsp;&nbsp;question: <span className="text-green-300">'Deploy v2.4 to production?'</span><br/>
                  {'}'});
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
