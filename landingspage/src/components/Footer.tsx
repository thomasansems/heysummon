import { trackDocsClick, trackGithubClick, trackWaitlistClick } from '../lib/analytics';

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 px-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center">
          <img src="/logo.png" alt="HeySummon Logo" className="h-8 w-auto grayscale hover:grayscale-0 transition-all opacity-80 hover:opacity-100" />
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm text-text-body">
          <a href="https://docs.heysummon.ai" target="_blank" rel="noopener noreferrer" onClick={() => trackDocsClick('footer')} className="hover:text-text-heading transition-colors">Documentation</a>
          <a href="https://github.com/thomasansems/heysummon" target="_blank" rel="noopener noreferrer" onClick={() => trackGithubClick('footer')} className="hover:text-text-heading transition-colors">GitHub</a>
          <a href="https://cloud.heysummon.ai" target="_blank" rel="noopener noreferrer" onClick={() => trackWaitlistClick('footer')} className="hover:text-text-heading transition-colors">Cloud</a>
          <a href="/privacy.html" className="hover:text-text-heading transition-colors">Privacy</a>
          <a href="/terms.html" className="hover:text-text-heading transition-colors">Terms</a>
          <a href="mailto:hello@heysummon.ai" className="hover:text-text-heading transition-colors">Contact</a>
        </div>
        <div className="text-sm text-text-muted">
          &copy; 2026 HeySummon. Sustainable Use License.
        </div>
      </div>
    </footer>
  );
}
