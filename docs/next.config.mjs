import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/_next/:path*',
          destination: 'https://fragola-sdk-landing.vercel.app/_next/:path*',
        },
      ],
      fallback: [
        {
          source: '/:path*',
          destination: 'https://fragola-sdk-landing.vercel.app/:path*',
        },
      ],
    };
  },
};

export default withMDX(config);