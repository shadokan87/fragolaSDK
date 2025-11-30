import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  async rewrites() {
    return [{
      source: "/",
      destination: "https://fragola-sdk-landing.vercel.app"
    }]
  },
};

export default withMDX(config);