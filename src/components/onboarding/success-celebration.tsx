"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface SuccessCelebrationProps {
  label: string;
  sublabel?: string;
  onContinue: () => void;
  continueLabel?: string;
}

export function SuccessCelebration({
  label,
  sublabel,
  onContinue,
  continueLabel = "Continue",
}: SuccessCelebrationProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="relative">
        {/* Ripple rings */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-green-500/30"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-green-500/20"
          initial={{ scale: 1, opacity: 0.4 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.15 }}
        />

        {/* Check circle */}
        <motion.div
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-green-600"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 300,
            damping: 15,
            mass: 0.8,
          }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 12,
              delay: 0.2,
            }}
          >
            <Check className="h-7 w-7 text-white" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </div>

      <motion.div
        className="text-center"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <p className="text-sm font-medium text-green-600 dark:text-green-400">
          {label}
        </p>
        {sublabel && (
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        )}
      </motion.div>

      <motion.button
        onClick={onContinue}
        className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
        {continueLabel}
      </motion.button>
    </div>
  );
}
