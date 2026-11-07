import { defineCollection } from 'astro:content'
import { z } from 'astro/zod'
import { glob } from 'astro/loaders'

const blog = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
    // Type-check frontmatter using a schema
    schema: z.object({
        title: z.string(),
        description: z.string(),
        // Transform string to Date object
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().optional(),
        heroImage: z.string().optional(),
        tags: z.array(z.string()).optional(),
    }),
})


const travel = defineCollection({
    loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/travel' }),
    schema: z.object({
        title: z.string(),
        description: z.string(),
        pubDate: z.coerce.date(),
        location: z.string().optional(),
        heroImage: z.string().optional(),
        heroImageAlt: z.string().optional(),
        tags: z.array(z.string()).optional(),
    }),
})

export const collections = { blog, travel }

