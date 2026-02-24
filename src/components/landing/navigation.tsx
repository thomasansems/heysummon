"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-dm-sans)] text-xl font-bold tracking-tight"
        >
          hey
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Summon
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <a
            href="#pricing"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Pricing
          </a>
          <a
            href="#"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Docs
          </a>
          <a
            href="#"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            GitHub
          </a>
        </div>

        <Link
          href="/auth/signup"
          className="rounded-full bg-white text-zinc-900 px-5 py-2 text-sm font-medium hover:bg-zinc-200 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </motion.nav>
  );
}
