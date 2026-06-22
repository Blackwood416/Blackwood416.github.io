import type { CollectionEntry } from 'astro:content';

export type BlogPost = CollectionEntry<'blog'>;
export type TaxonomyCount = { name: string; count: number };
export type ArchiveGroup = { key: string; year: string; month: string; posts: BlogPost[] };
export type PostNeighbor = BlogPost | null;
export type PostNeighbors = { previous: PostNeighbor; next: PostNeighbor };
export type TocHeading = { depth: number; slug: string; text: string };
export type CodeFenceMeta = { language: string | null; title: string | null; label: string };

export function getVisiblePosts(posts: BlogPost[]): BlogPost[] {
	return posts
		.filter((post) => !post.data.draft)
		.toSorted((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

// Use only when constructing hrefs; pass raw values to Astro getStaticPaths().params.
export function encodeHrefSegment(value: string): string {
	return encodeURIComponent(value);
}

export function countTaxonomy(posts: BlogPost[], key: 'tags' | 'categories'): TaxonomyCount[] {
	const counts = new Map<string, number>();

	for (const post of posts) {
		for (const name of post.data[key]) {
			counts.set(name, (counts.get(name) ?? 0) + 1);
		}
	}

	return Array.from(counts, ([name, count]) => ({ name, count })).sort(
		(a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'),
	);
}

export function groupPostsByYearMonth(posts: BlogPost[]): ArchiveGroup[] {
	const groups = new Map<string, BlogPost[]>();

	for (const post of posts) {
		const pubDate = post.data.pubDate;
		const year = String(pubDate.getUTCFullYear());
		const month = String(pubDate.getUTCMonth() + 1).padStart(2, '0');
		const key = `${year}-${month}`;

		groups.set(key, [...(groups.get(key) ?? []), post]);
	}

	return Array.from(groups, ([key, groupedPosts]) => {
		const [year, month] = key.split('-');

		return {
			key,
			year,
			month,
			posts: groupedPosts,
		};
	}).sort((a, b) => b.key.localeCompare(a.key));
}

export function getPostNeighbors(posts: BlogPost[], currentId: string): PostNeighbors {
	const index = posts.findIndex((post) => post.id === currentId);

	if (index === -1) {
		return { previous: null, next: null };
	}

	return {
		previous: posts[index - 1] ?? null,
		next: posts[index + 1] ?? null,
	};
}

export function getTableOfContentsItems(headings: TocHeading[]): TocHeading[] {
	const items = headings.filter((heading) => heading.depth === 2 || heading.depth === 3);

	return items.length >= 2 ? items : [];
}

export function parseCodeFenceMeta(meta: string | undefined): CodeFenceMeta {
	const source = meta?.trim() ?? '';
	const firstToken = source.match(/^[^\s]+/)?.[0] ?? null;
	const titleMatch = source.match(/(?:^|\s)title=(?:"([^"]*)"|'([^']*)'|([^\s]+))/);
	const language = firstToken && !firstToken.includes('=') && !firstToken.startsWith('{') ? firstToken : null;
	const title = titleMatch?.[1] ?? titleMatch?.[2] ?? titleMatch?.[3] ?? null;

	return {
		language,
		title,
		label: title ?? language ?? 'code',
	};
}
