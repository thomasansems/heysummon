import React from 'react'
import { DocsThemeConfig, useConfig } from 'nextra-theme-docs'
import { useRouter } from 'next/router'
import {
  BookOpen,
  Rocket,
  Puzzle,
  Link as LinkIcon,
  Bot,
  Users,
  Sparkles,
  Server,
  Shield,
  FileText,
  Heart,
} from 'lucide-react'

const SITE_URL = 'https://docs.heysummon.ai'
const DEFAULT_TITLE = 'HeySummon Docs'
const DEFAULT_DESCRIPTION =
  'Documentation for HeySummon — Human in the Loop as a Service'

// Cast lucide icons through `unknown` to a permissive component type.
// lucide-react's hoisted typings resolve to a different @types/react version
// in this monorepo, which would otherwise produce a JSX element-type mismatch.
type IconComponent = React.ComponentType<{ size?: number }>
const asIcon = (Icon: unknown): IconComponent => Icon as IconComponent

const SIDEBAR_ICONS: Record<string, IconComponent> = {
  Introduction: asIcon(BookOpen),
  'Getting Started': asIcon(Rocket),
  'Client Integrations': asIcon(Puzzle),
  'Other Integrations': asIcon(LinkIcon),
  'For AI Agents (Consumer)': asIcon(Bot),
  'For Human Experts': asIcon(Users),
  'Summoning Guidelines': asIcon(Sparkles),
  'Self-Hosting': asIcon(Server),
  Security: asIcon(Shield),
  Reference: asIcon(FileText),
  Contributing: asIcon(Heart),
}

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <img src="/logo.png" alt="HeySummon" width={28} height={28} />
      <span style={{ fontWeight: 700, fontSize: '1.2em', fontFamily: 'DM Sans, sans-serif' }}>
        Docs
      </span>
    </span>
  ),
  sidebar: {
    titleComponent({ title, type }) {
      const Icon = SIDEBAR_ICONS[title]
      if (type === 'separator' || !Icon) {
        return <>{title}</>
      }
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon size={16} />
          {title}
        </span>
      )
    },
  },
  useNextSeoProps() {
    const { asPath } = useRouter()
    if (asPath === '/') {
      return { titleTemplate: DEFAULT_TITLE }
    }
    return { titleTemplate: `%s — ${DEFAULT_TITLE}` }
  },
  project: {
    link: 'https://github.com/thomasansems/heysummon',
  },
  docsRepositoryBase: 'https://github.com/thomasansems/heysummon/tree/main/website',
  footer: {
    text: 'HeySummon — Human in the Loop as a Service',
  },
  darkMode: true,
  head: function Head() {
    const { asPath } = useRouter()
    const { frontMatter, title } = useConfig()
    const pageTitle = frontMatter.title || title || DEFAULT_TITLE
    const ogTitle = pageTitle === DEFAULT_TITLE ? pageTitle : `${pageTitle} — HeySummon`
    const description = frontMatter.description || DEFAULT_DESCRIPTION
    const url = SITE_URL + asPath

    return (
      <>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="description" content={description} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content="HeySummon Docs" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={description} />
        <link rel="canonical" href={url} />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=swap" rel="stylesheet" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon-96x96.png" sizes="96x96" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </>
    )
  },
}

export default config
