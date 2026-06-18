import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		draft: z.boolean().default(false),
		cover: z.string().optional(),
	}),
});

const cases = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
	schema: z.object({
		title: z.string(),
		client: z.string(),
		summary: z.string(),
		industry: z.string().optional(),
		year: z.number().int().optional(),
		stack: z.array(z.string()).default([]),
		services: z.array(z.string()).default([]),
		featured: z.boolean().default(false),
		order: z.number().int().default(0),
		cover: z.string().optional(),
		coverVideo: z.string().optional(),
	}),
});

const services = defineCollection({
	loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
	schema: z.object({
		title: z.string(),
		summary: z.string(),
		group: z.enum(['Разработка', 'Автоматизация', 'Дополнительно']),
		icon: z.string().optional(),
		order: z.number().int().default(0),
	}),
});

export const collections = { posts, cases, services };
