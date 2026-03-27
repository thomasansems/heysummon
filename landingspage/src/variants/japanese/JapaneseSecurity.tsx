import { motion } from 'motion/react';
import { Shield, Lock, Server, FileCheck } from 'lucide-react';

const features = [
  { icon: Server, title: "Self-Hosted", desc: "Your infrastructure, your rules. Complete control over your data." },
  { icon: Lock, title: "E2E Encryption", desc: "NaCl end-to-end encryption. The server cannot read your messages." },
  { icon: FileCheck, title: "Audit Trails", desc: "Full audit logging for compliance and accountability." },
  { icon: Shield, title: "Zero Vendor Access", desc: "We have absolutely no access to your sensitive workflows." }
];

export function JapaneseSecurity() {
  return (
    <section id="security" className="py-32 px-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="text-center mb-16"
      >
        <div className="flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-[#8a7d6e] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]"></span>
          Security
        </div>
        <h2 className="text-4xl md:text-5xl mb-6">Your data never leaves your network.</h2>
        <p className="text-lg text-[#c4b5a0] max-w-2xl mx-auto">
          Enterprise-grade security that doesn't compromise on usability. Self-hosted and end-to-end encrypted.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 1, delay: 0.15 * i, ease: [0.25, 0.1, 0.25, 1] }}
            className="paper-texture border border-[#f59e0b]/15 rounded-2xl p-6 hover:border-[#f59e0b]/30 transition-colors duration-500"
          >
            <div className="w-12 h-12 rounded-xl bg-[#dc2626]/10 text-[#dc2626] flex items-center justify-center mb-6">
              <feature.icon className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
            <p className="text-sm text-[#c4b5a0] leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
