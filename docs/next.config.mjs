import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
    async rewrites() {
    return [
      {
        source: '/',
        destination: '/docs',
      },
      {
        source: '/:slug*',
        destination: '/docs/:slug*',
      },
    ];
  },
};

export default withMDX(config);
