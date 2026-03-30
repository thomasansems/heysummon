import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

interface StepCardProps {
  step: number;
  icon: LucideIcon;
  title: string;
  description: string;
  index?: number;
}

export function StepCard({ step, icon: Icon, title, description, index = 0 }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-colors duration-500"
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-mono font-bold">
          {step}
        </span>
        <div className="w-10 h-10 rounded-xl bg-white/5 text-text-heading flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <h3 className="text-lg font-semibold text-text-heading mb-2">{title}</h3>
      <p className="text-sm text-text-body leading-relaxed">{description}</p>
    </motion.div>
  );
}
