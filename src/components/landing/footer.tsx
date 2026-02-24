"use client";

import { motion } from "framer-motion";
import Link from "next/link";

const links = {
  Product: [
    { label: "Pricing", href: "#pricing" },
    { label: "Documentation", href: "#" },
    { label: "Changelog", href: "#" },
  ],
  Resources: [
    { label: "GitHub", href: "#" },
    { label: "API Reference", href: "#" },
    { label: "Status", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
    { label: "Security", href: "#" },
  ],
};

export function Footer() {
  return (
    <footer className="relative border-t border-zinc-800/50">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5 }}
          className="grid md:grid-cols-4 gap-10"
        >
          {/* Brand */}
          <div>
            <Link
              href="/"
              className="font-[family-name:var(--font-dm-sans)] text-lg font-bold tracking-tight"
            >
              hey
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                Summon
              </span>
            </Link>
            <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
              Built for AI agents that know when to ask for help.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(links).map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-zinc-800/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-600">
            &copy; {new Date().getFullYear()} HeySummon. All rights reserved.
          </p>
          <p className="text-xs text-zinc-700">
            Human-in-the-Loop as a Service
          </p>
        </div>
      </div>
    </footer>
  );
}
