import { Star } from 'lucide-react';
import { trackGithubClick } from '../lib/analytics';

const GITHUB_REPO_URL = 'https://github.com/thomasansems/heysummon';
const FALLBACK_LABEL = 'Star on GitHub';

function humanizeCount(value: number): string {
  if (value < 1000) return value.toString();
  const thousands = value / 1000;
  return `${thousands.toFixed(thousands < 10 ? 1 : 0).replace(/\.0$/, '')}k`;
}

interface GitHubStarsProps {
  location: string;
  className?: string;
}

export function GitHubStars({ location, className }: GitHubStarsProps) {
  const stars = typeof __GITHUB_STARS__ === 'number' ? __GITHUB_STARS__ : null;
  const label = stars === null ? FALLBACK_LABEL : `${humanizeCount(stars)} on GitHub`;

  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => trackGithubClick(location)}
      aria-label={
        stars === null
          ? 'Star HeySummon on GitHub'
          : `HeySummon has ${stars.toLocaleString('en-US')} stars on GitHub`
      }
      className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-sm text-text-body bg-white/5 border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors ${className ?? ''}`.trim()}
    >
      <Star className="w-4 h-4 fill-current text-yellow-300" aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
