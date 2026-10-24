import mdx from '@mdx-js/rollup';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';
import remarkMath from 'remark-math';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // Wichtig: mdx() muss vor react() stehen!
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeKatex,
        // Hier kannst du später das Theme ändern (z.B. 'dracula' oder 'github-dark')
        [rehypePrettyCode, { theme: 'github-dark-dimmed' }],
      ],
      providerImportSource: '@mdx-js/react',
    }),
    react(),
    tailwindcss(),
  ],
});
