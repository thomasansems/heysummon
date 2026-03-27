import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
})

export default withNextra({
  // Nextra 2.x uses webpack config internally.
  // Disable Turbopack to prevent "webpack config with no turbopack config" error.
  turbopack: {},
})
