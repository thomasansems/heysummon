import React from 'react'
import { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: <span style={{ fontWeight: 700, fontSize: '1.2em', fontFamily: 'DM Sans, sans-serif' }}>heySummon <span style={{ fontWeight: 400, opacity: 0.6 }}>Docs</span></span>,
  project: {
    link: 'https://github.com/thomasansems/heysummon',
  },
  docsRepositoryBase: 'https://github.com/thomasansems/heysummon/tree/main/website',
  footer: {
    text: 'HeySummon — Human in the Loop as a Service',
  },
  darkMode: true,
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta property="og:title" content="HeySummon Docs" />
      <meta property="og:description" content="Documentation for HeySummon — Human in the Loop as a Service" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@700&display=swap" rel="stylesheet" />
      <link rel="icon" href="/favicon.ico" sizes="any" />
      <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    </>
  ),
}

export default config
