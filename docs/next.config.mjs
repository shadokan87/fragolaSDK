import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Proxy Next.js static assets to the external site
      {
        source: '/_next/:path*',
        destination: 'https://fragola-sdk-landing.vercel.app/_next/:path*',
      },
      // Proxy all other requests to the external site
      {
        source: '/:path*',
        destination: 'https://fragola-sdk-landing.vercel.app/:path*',
      },
    ];
  },
};

export default withMDX(config);
