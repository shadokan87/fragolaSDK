import type { Config } from '@docusaurus/types';

const config: Config = {
  title: 'Fragola SDK',
  tagline: 'Agentic SDK on top of OpenAI',
  url: 'http://localhost',
  baseUrl: '/',
  favicon: 'img/favicon.ico',
  organizationName: 'fragola-ai',
  projectName: 'fragolaSDK',
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        }
      }
    ]
  ]
};

export default config;
