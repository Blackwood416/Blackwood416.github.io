import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		updated: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		categories: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	}).transform((data) => ({
		...data,
		updatedDate: data.updatedDate ?? data.updated,
	})),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		avatar: z.string().optional(),
		subtitle: z.string().optional(),
		status: z.string().optional(),
		skills: z.array(z.object({
			category: z.string(),
			items: z.array(z.string()),
		})).optional(),
		interests: z.array(z.string()).optional(),
		equipment: z.array(z.object({
			name: z.string(),
			specs: z.string(),
		})).optional(),
		socials: z.array(z.object({
			platform: z.string(),
			link: z.string(),
			icon: z.string().optional(),
		})).optional(),
	}),
});

const news = defineCollection({
	loader: glob({ base: './src/content/news', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		updated: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		categories: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
	}).transform((data) => ({
		...data,
		updatedDate: data.updatedDate ?? data.updated,
	})),
});

export const collections = { blog, pages, news };
