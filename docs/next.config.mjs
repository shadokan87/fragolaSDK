import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  assetPrefix: "https://www.fragola.ai",
  async rewrites() {
    return {
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