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

export function SkillSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <section id="skill" className="py-32 px-8 max-w-6xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-text-muted mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              Skill
            </div>
            <h2 className="font-serif text-4xl md:text-5xl mb-6">One call. One answer.<br/>Every channel.</h2>
            <p className="text-lg text-text-body mb-8">
              Import the skill, ask a question, get an answer. Your AI agent pauses, a human expert responds via their preferred channel, and the workflow continues.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1.2, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl"
          >
            <h3 className="font-serif text-2xl mb-2">HeySummon Skill</h3>
            <p className="text-text-body mb-6 text-sm">Easily install a skill via the <code className="text-primary">npx skill.sh</code> framework.</p>

            <div className="space-y-4">
              {skills.map((skill, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 0.4 + index * 0.1, ease: "easeOut" }}
                  className="border border-white/5 rounded-xl overflow-hidden bg-white/[0.02]"
                >
                  <button
                    onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className={`w-5 h-5 transition-colors duration-300 ${expandedIndex === index ? 'text-green-check' : 'text-text-muted'}`} />
                      <span className={`font-medium transition-colors duration-300 ${expandedIndex === index ? 'text-text-heading' : 'text-text-body'}`}>
                        {skill.title}
                      </span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-300 ${expandedIndex === index ? 'rotate-180' : ''}`} />
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
                        <div className="p-4 pt-0 pl-12 text-sm text-text-body">
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

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.4, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative rounded-2xl overflow-hidden min-h-[500px] border border-white/10"
        >
          <img src="https://images.pexels.com/photos/167698/pexels-photo-167698.jpeg?auto=compress&cs=tinysrgb&w=800" alt="Forest" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-deep via-bg-deep/50 to-transparent" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, delay: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            className="absolute bottom-0 left-0 right-0 p-8"
          >
            <div className="bg-bg-deep/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-xs font-mono text-text-muted ml-2">terminal</span>
              </div>
              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                <div className="text-primary">$ npx skill.sh install heysummon</div>
                <div className="text-text-muted mt-2">Installing HeySummon skill...</div>
                <div className="text-green-check mt-1">&#10003; Skill installed successfully</div>
                <div className="mt-4 text-text-body">
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
