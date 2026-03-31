import type { ReactNode } from 'react';

interface TerminalMockupProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function TerminalMockup({ title = 'terminal', children, className = '' }: TerminalMockupProps) {
  return (
    <div
      className={`bg-bg-deep/80 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl ${className}`}
      role="img"
      aria-label={`Terminal showing ${title}`}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        <span className="text-xs font-mono text-text-muted ml-2">{title}</span>
      </div>
      <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto whitespace-pre">
        {children}
      </div>
    </div>
  );
}
