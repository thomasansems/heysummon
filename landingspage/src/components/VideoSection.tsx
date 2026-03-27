import { motion } from 'motion/react';

export function VideoSection() {
  return (
    <section className="py-32 px-8 max-w-6xl mx-auto text-center">
      <div>
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="font-serif text-4xl md:text-5xl mb-8 text-text-heading"
        >
          Human judgment <br/>
          <span className="italic">where it matters the most.</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.2, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-xl text-text-body max-w-3xl mx-auto mb-16"
        >
          AI is fast, but humans provide the context, empathy, and final say that algorithms lack. We make it seamless to bring a human into the loop exactly when needed, so you can trust your automated workflows.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.4, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-bg-card aspect-video max-w-5xl mx-auto group cursor-pointer"
        >
          {/* Placeholder for video */}
          <div className="absolute inset-0 flex items-center justify-center bg-bg-deep/50 group-hover:bg-bg-deep/40 transition-colors duration-500 z-10">
            <motion.div
              whileHover={{ scale: 1.15 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary backdrop-blur-md border border-primary/30"
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </motion.div>
          </div>
          <img src="https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Platform UI" className="w-full h-full object-cover opacity-50" />

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
            className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10"
          >
            <div className="bg-bg-deep/80 backdrop-blur-md px-4 py-2 rounded-lg text-sm font-medium border border-white/10">
              Platform UI Overview
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
