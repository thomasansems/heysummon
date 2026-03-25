// HeySummon — content layer
// All site copy lives here. Change text without touching design files.
// Each version (v1/v2/v3) imports from this file.

export const seo = {
  title: "HeySummon — Human-in-the-Loop API for AI Agents",
  titleShort: "HeySummon",
  description:
    "HeySummon is an open-source human-in-the-loop platform for AI agents. When your agent gets stuck, needs approval, or lacks context, it summons a human. E2E encrypted, self-hostable, platform-agnostic.",
  keywords: [
    "human in the loop",
    "HITL",
    "AI agent approval",
    "human in the loop API",
    "AI agent oversight",
    "human-in-the-loop platform",
    "open source HITL",
    "self-hosted human in the loop",
    "AI agent escalation",
    "agent checkpoint",
    "human oversight AI",
    "heysummon",
  ],
  ogImage: "https://heysummon.ai/og.png",
  canonical: "https://heysummon.ai",
  twitterHandle: "@heysummon",
};

export const nav = {
  logo: "HeySummon",
  links: [
    { label: "Docs", href: "https://docs.heysummon.ai" },
    { label: "Self-Hosting", href: "https://docs.heysummon.ai/self-hosting/docker" },
    { label: "GitHub", href: "https://github.com/thomasansems/heysummon" },
  ],
  cta: { label: "Join Waitlist", href: "https://cloud.heysummon.ai" },
};

export const hero = {
  eyebrow: "Human-in-the-Loop as a Service",
  headline: "Hey summon JohnDoe.",
  subheadline:
    "The open-source API that lets AI agents ask humans for help. E2E encrypted, self-hostable, platform-agnostic.",
  description:
    "HeySummon is a human-in-the-loop (HITL) platform for AI agents. When an agent gets stuck, needs approval, or lacks context only a human has — it sends an encrypted help request. A human responds. The agent continues.",
  ctas: [
    { label: "npx heysummon", href: "#install", type: "primary" as const },
    { label: "Join the cloud waitlist", href: "https://cloud.heysummon.ai", type: "secondary" as const },
  ],
  badge: "Open source — free forever",
};

export const problem = {
  eyebrow: "The Problem",
  headline: "AI agents are powerful. But imperfect.",
  body: [
    "They get stuck on ambiguous tasks. They proceed blindly when they should ask. They take irreversible actions without approval. They lack context that only you have.",
    "Building ad-hoc Slack bots or webhook hacks is slow, insecure, and impossible to maintain. There has been no standard, encrypted, self-hostable way to add a human checkpoint to an agentic workflow.",
    "Until now.",
  ],
  callout:
    '"My agent just deleted something it should not have. There was no way to stop it."',
};

export const howItWorks = {
  eyebrow: "How It Works",
  headline: "Three steps. Then back to work.",
  steps: [
    {
      number: "01",
      title: "Agent sends a help request",
      description:
        "Your AI agent calls the HeySummon API with an encrypted question — needs approval, hit ambiguity, or lacks context. Gets back a reference code like HS-A1B2.",
      code: `const hs = new HeySummon({ apiKey: "hs_live_..." });\nconst answer = await hs.ask(\n  "Delete the old records?"\n);`,
    },
    {
      number: "02",
      title: "Human receives and responds",
      description:
        "You see the request in the dashboard — decrypted, readable. Reply from the dashboard or via Telegram. The message was never readable by the server.",
    },
    {
      number: "03",
      title: "Agent picks up the answer",
      description:
        "The agent polls for the response, decrypts it, and continues the workflow — with the human's answer as context. Zero workflow interruption.",
    },
  ],
};

export const features = [
  {
    id: "encryption",
    icon: "lock",
    title: "End-to-End Encrypted",
    description:
      "X25519 key exchange + AES-256-GCM message encryption + Ed25519 request signing. The server stores ciphertext it cannot read. Zero-knowledge relay.",
    detail: "X25519 · AES-256-GCM · Ed25519",
  },
  {
    id: "selfhost",
    icon: "server",
    title: "Self-Hostable",
    description:
      "Your data never leaves your infrastructure. Run locally with SQLite in 2 minutes via npx, or deploy with Docker and PostgreSQL for production. Full control.",
    detail: "npx heysummon · Docker · PostgreSQL",
  },
  {
    id: "agnostic",
    icon: "plug",
    title: "Platform-Agnostic",
    description:
      "Native integrations for Claude Code, Codex, and n8n. Works with any agent that can make an HTTP request. No framework lock-in. One API, all your agents.",
    detail: "Claude Code · Codex · n8n · HTTP",
  },
  {
    id: "opensource",
    icon: "code",
    title: "Open Source",
    description:
      "Published under the Sustainable Use License. Free for personal and internal business use. Auditable, forkable, community-driven. No vendor lock-in.",
    detail: "Sustainable Use License · GitHub",
  },
];

export const install = {
  eyebrow: "Quick Install",
  headline: "Running in 2 minutes.",
  options: [
    {
      label: "NPX (fastest)",
      description: "No Docker. No Git. Interactive setup.",
      code: "npx heysummon",
      sub: "heysummon start -d   # background\nheysummon stop       # stop\nheysummon status     # check URL\nheysummon update     # update",
    },
    {
      label: "Docker (recommended for production)",
      description: "PostgreSQL, Guard proxy, tunnel profiles.",
      code: 'curl -fsSL https://raw.githubusercontent.com/\nthomasansems/heysummon/main/install.sh | bash',
    },
  ],
  sdkSnippet: `import { HeySummon } from "@heysummon/sdk";\n\nconst hs = new HeySummon({ apiKey: "hs_live_..." });\n\n// Your agent asks a human\nconst answer = await hs.ask(\n  "Should I proceed with the migration?"\n);\n\nconsole.log(answer); // "Yes, proceed — backup is ready."`,
};

export const integrations = {
  eyebrow: "Integrations",
  headline: "Works with the agents you already use.",
  items: [
    {
      name: "Claude Code",
      description: "MCP server integration. Claude asks you before taking risky actions.",
      setup: "Paste setup link in chat. Done in 60 seconds.",
    },
    {
      name: "Codex / OpenClaw",
      description: "Shell script integration with hook-based response delivery.",
      setup: "Install the skill, register provider, start watcher.",
    },
    {
      name: "n8n",
      description: "HTTP node integration. Pause any workflow for human approval.",
      setup: "POST to /api/v1/help, poll /api/v1/help/:id.",
    },
    {
      name: "Any HTTP Client",
      description: "REST API. If your agent can make an HTTP request, it works with HeySummon.",
      setup: "Two endpoints. One for asking, one for polling.",
    },
  ],
};

export const openSource = {
  eyebrow: "Open Source",
  headline: "Built in the open.",
  body:
    "HeySummon is open source under the Sustainable Use License — free for personal and internal business use. Self-hosted instances run forever at no cost. The managed cloud is currently in waitlist.",
  stats: [
    { label: "License", value: "Sustainable Use" },
    { label: "Database", value: "SQLite or PostgreSQL" },
    { label: "Install time", value: "~2 minutes" },
    { label: "Dependencies", value: "Zero (NPX)" },
  ],
  github: "https://github.com/thomasansems/heysummon",
};

export const faq = {
  eyebrow: "FAQ",
  headline: "Common questions.",
  items: [
    {
      question: "What is human-in-the-loop (HITL) for AI agents?",
      answer:
        "Human-in-the-loop (HITL) is a design pattern where an AI system pauses at critical decision points and requests input from a human — for approval, clarification, or judgment calls the AI cannot handle alone. HeySummon implements HITL as a standalone API, so any AI agent can add a human checkpoint without custom infrastructure.",
    },
    {
      question: "What is HeySummon?",
      answer:
        "HeySummon is an open-source human-in-the-loop platform. When an AI agent needs a human — for approval, context, or to handle ambiguity — it sends an encrypted help request via the HeySummon API. A human responds via the dashboard or Telegram. The agent picks up the answer and continues. Think of it as a pager for your AI agents.",
    },
    {
      question: "How does the encryption work?",
      answer:
        "HeySummon uses X25519 Diffie-Hellman for key exchange, AES-256-GCM for message encryption, and Ed25519 for request signing via the Guard proxy. The server stores only ciphertext — it cannot decrypt your messages. Even the HeySummon team cannot read your agent's questions or your answers.",
    },
    {
      question: "Can I self-host HeySummon?",
      answer:
        "Yes. Run `npx heysummon` for a 2-minute local setup using SQLite — no Docker or Git required. For production, use the Docker install with PostgreSQL, Guard proxy, and optional Cloudflare, Tailscale, or Ngrok tunnel. Your data stays on your infrastructure.",
    },
    {
      question: "What AI agents work with HeySummon?",
      answer:
        "Any agent that can make HTTP requests. Native integrations exist for Claude Code (via MCP server), Codex/OpenClaw (shell hooks), and n8n (HTTP nodes). The Node.js SDK (@heysummon/sdk) makes integration trivial for JavaScript/TypeScript agents.",
    },
    {
      question: "Is HeySummon free?",
      answer:
        "Yes. HeySummon is free under the Sustainable Use License for personal and internal business use — forever. The managed cloud (cloud.heysummon.ai) is currently in waitlist. Self-hosted instances will always be free.",
    },
    {
      question: "How do I get started?",
      answer:
        "Run `npx heysummon` in your terminal. It downloads the latest release, generates cryptographic secrets, configures the database, and starts the server — in about 2 minutes. Then create an API key in the dashboard and integrate with your agent.",
    },
  ],
};

export const cta = {
  headline: "Start summoning.",
  subheadline:
    "Self-host in 2 minutes. Join the cloud waitlist for the managed version.",
  primary: { label: "npx heysummon", href: "#install" },
  secondary: { label: "Join cloud waitlist", href: "https://cloud.heysummon.ai" },
  tertiary: { label: "Read the docs", href: "https://docs.heysummon.ai" },
};

export const footer = {
  tagline: "Human-in-the-Loop as a Service",
  links: [
    { label: "Docs", href: "https://docs.heysummon.ai" },
    { label: "GitHub", href: "https://github.com/thomasansems/heysummon" },
    { label: "Cloud Waitlist", href: "https://cloud.heysummon.ai" },
    { label: "Self-Hosting", href: "https://docs.heysummon.ai/self-hosting/docker" },
    { label: "Security", href: "https://docs.heysummon.ai/security/overview" },
    { label: "API Reference", href: "https://docs.heysummon.ai/reference/api" },
    { label: "Contributing", href: "https://github.com/thomasansems/heysummon/blob/main/CONTRIBUTING.md" },
  ],
  license: "Sustainable Use License",
  copyright: `© ${new Date().getFullYear()} HeySummon`,
};

// JSON-LD structured data for AI-SEO
export const structuredData = {
  software: {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "HeySummon",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Linux, macOS, Windows (WSL2)",
    description:
      "HeySummon is an open-source human-in-the-loop (HITL) API for AI agents. When an AI agent needs approval, hits ambiguity, or lacks context, it sends an encrypted help request. A human responds. The agent continues.",
    url: "https://heysummon.ai",
    downloadUrl: "https://www.npmjs.com/package/heysummon",
    softwareVersion: "0.1.0",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free under the Sustainable Use License",
    },
    license: "https://heysummon.ai/license",
    codeRepository: "https://github.com/thomasansems/heysummon",
    programmingLanguage: "TypeScript",
    keywords:
      "human in the loop, HITL, AI agent, approval, encrypted, self-hostable, open source",
  },
  organization: {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "HeySummon",
    url: "https://heysummon.ai",
    logo: "https://heysummon.ai/hey-summon.png",
    sameAs: [
      "https://github.com/thomasansems/heysummon",
    ],
  },
  faqSchema: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  },
  breadcrumb: {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "HeySummon",
        item: "https://heysummon.ai",
      },
    ],
  },
};
