import './japanese-theme.css';
import { JapaneseNavbar } from './JapaneseNavbar';
import { JapaneseHero } from './JapaneseHero';
import { JapaneseVideoSection } from './JapaneseVideoSection';
import { JapaneseSkillSection } from './JapaneseSkillSection';
import { JapaneseFrameworks } from './JapaneseFrameworks';
import { JapaneseSecurity } from './JapaneseSecurity';
import { JapaneseCTA } from './JapaneseCTA';
import { JapaneseFooter } from './JapaneseFooter';

export default function JapaneseApp() {
  return (
    <div className="japanese-variant min-h-screen selection:bg-[#dc2626]/30">
      <JapaneseNavbar />
      <main>
        <JapaneseHero />
        <JapaneseVideoSection />
        <JapaneseSkillSection />
        <JapaneseFrameworks />
        <JapaneseSecurity />
        <JapaneseCTA />
      </main>
      <JapaneseFooter />
    </div>
  );
}
