import { createMDX } from 'fumadocs-mdx/next';
import { visit } from 'unist-util-visit';

function remarkReplaceModel() {
  return (tree) => {
    visit(tree, 'code', (node) => {
      if (node.value && node.value.includes('__DEFAULT_MODEL__')) {
        const defaultModel = process.env.DEFAULT_MODEL || 'gpt-6-astra';
        node.value = node.value.replace(/__DEFAULT_MODEL__/g, defaultModel);
      }
    });
  };
}

const withMDX = createMDX({
  mdxOptions: {
    remarkPlugins: [remarkReplaceModel],
  },
});

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default withMDX(config);
