// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';
import remarkCodeBlockMeta from './src/lib/remark-code-block-meta.ts';
import rehypeCodeBlocks from './src/lib/rehype-code-blocks.ts';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkReadingTime from './src/lib/remark-reading-time.ts';

// https://astro.build/config
export default defineConfig({
	site: 'https://blog.blackwood.cv',
	devToolbar: {
		enabled: false,
	},
	integrations: [mdx(), sitemap()],
	markdown: {
		remarkPlugins: [remarkMath, remarkReadingTime, remarkCodeBlockMeta],
		rehypePlugins: [rehypeCodeBlocks, rehypeKatex],
		shikiConfig: {
			theme: 'one-dark-pro',
		},
	},
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
