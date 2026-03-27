import { trackDocsClick, trackGithubClick, trackWaitlistClick } from '../../lib/analytics';

export function JapaneseFooter() {
  return (
    <footer className="border-t border-[#f59e0b]/20 py-12 px-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center">
          <img src="/logo.png" alt="HeySummon Logo" className="h-8 w-auto grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100" />
        </div>
        <div className="flex gap-6 text-sm text-[#c4b5a0]">
          <a href="https://docs.heysummon.ai" target="_blank" rel="noopener noreferrer" onClick={() => trackDocsClick('footer')} className="hover:text-[#faf5ef] transition-colors">Documentation</a>
          <a href="https://github.com/thomasansems/heysummon" target="_blank" rel="noopener noreferrer" onClick={() => trackGithubClick('footer')} className="hover:text-[#faf5ef] transition-colors">GitHub</a>
          <a href="https://cloud.heysummon.ai" target="_blank" rel="noopener noreferrer" onClick={() => trackWaitlistClick('footer')} className="hover:text-[#faf5ef] transition-colors">Cloud</a>
        </div>
        <div className="text-sm text-[#8a7d6e]">
          &copy; 2026 HeySummon. Sustainable Use License.
        </div>
      </div>
    </footer>
  );
}
