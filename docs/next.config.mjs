import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  assetPrefix: '/docs',
  cleanUrls: true,
  trailingSlash: true,
};

export default withMDX(config);