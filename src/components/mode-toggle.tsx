"use client";

import { motion } from "framer-motion";

interface ModeToggleProps {
  mode: "ai" | "human";
  onToggle: (mode: "ai" | "human") => void;
}

export function ModeToggle({ mode, onToggle }: ModeToggleProps) {
  return (
    <div className="fixed top-20 left-1/2 z-50 -translate-x-1/2">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-center gap-1 rounded-full p-1 shadow-lg backdrop-blur-md ${
          mode === "ai"
            ? "border border-violet-500/30 bg-zinc-900/90"
            : "border border-amber-200/30 bg-white/90"
        }`}
      >
        <button
          onClick={() => onToggle("ai")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
            mode === "ai"
              ? "bg-violet-600 text-white shadow-md"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          🤖 For AI
        </button>
        <button
          onClick={() => onToggle("human")}
          className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all ${
            mode === "human"
              ? "bg-amber-700 text-white shadow-md"
              : mode === "ai"
              ? "text-zinc-400 hover:text-zinc-300"
              : "text-zinc-500 hover:text-zinc-700"
          }`}
        >
          👨‍💻 For Humans
        </button>
      </motion.div>
    </div>
  );
}
