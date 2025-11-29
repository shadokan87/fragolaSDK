import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // assetPrefix: "https://fragola-sdk.vercel.app"
};

export default withMDX(config);
