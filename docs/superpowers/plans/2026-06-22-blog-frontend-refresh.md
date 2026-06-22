# Blog Frontend Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the Astro blog into a light technical knowledge-base experience with One Dark code blocks, article table of contents, and previous/next article navigation.

**Architecture:** Keep content and routing in Astro's existing content collection flow. Add small blog utility functions for neighbor navigation, TOC filtering, and code fence metadata parsing; use a build-time rehype plugin for code block wrappers; then layer focused Astro components and global CSS on top.

**Tech Stack:** Astro 6, Astro content collections, MDX integration, Rehype AST transform, Vitest, Pagefind static search.

---

## File Structure

- Modify `src/lib/blog.ts`: add pure helpers for post neighbors, TOC filtering, and code fence metadata parsing.
- Create `tests/code-blocks.test.mjs`: tests for code fence metadata parsing.
- Modify `tests/blog-utils.test.mjs`: tests for previous/next navigation and TOC filtering.
- Create `src/lib/rehype-code-blocks.mjs`: rehype plugin that wraps code blocks with One Dark editor markup.
- Modify `astro.config.mjs`: register the rehype plugin in Markdown rendering.
- Modify `src/pages/posts/[slug].astro`: pass rendered headings and previous/next post data into the article layout.
- Create `src/components/TableOfContents.astro`: renders desktop sticky TOC and mobile collapsed TOC.
- Create `src/components/PostNavigation.astro`: renders previous/next links.
- Modify `src/layouts/BlogPost.astro`: article shell, TOC, post navigation, code copy script.
- Modify `src/components/Header.astro`: compact technical navigation refresh.
- Modify `src/components/Footer.astro`: add RSS and repo links if constants are present.
- Modify `src/pages/index.astro`, `src/pages/posts/index.astro`, `src/pages/archives/index.astro`, `src/pages/tags/index.astro`, `src/pages/categories/index.astro`: apply consistent list/taxonomy markup if needed.
- Modify `src/styles/global.css`: visual refresh, prose styles, One Dark code blocks, responsive layout, focus states.
- Modify `tests/site-shell.test.mjs`: add structural checks for code block assets, TOC component, and previous/next component.

## Task 1: Blog Utility Tests And Helpers

**Files:**
- Modify: `src/lib/blog.ts`
- Modify: `tests/blog-utils.test.mjs`
- Create: `tests/code-blocks.test.mjs`

- [ ] **Step 1: Add failing tests for previous/next navigation**

Add these imports in `tests/blog-utils.test.mjs`:

```js
import {
  countTaxonomy,
  encodeHrefSegment,
  getPostNeighbors,
  getTableOfContentsItems,
  groupPostsByYearMonth,
} from '../src/lib/blog.ts';
```

Add this test block:

```js
describe('getPostNeighbors', () => {
  it('returns the newer post as previous and older post as next in descending post order', () => {
    const posts = [
      { id: 'newest', data: { title: 'Newest', pubDate: new Date('2024-03-01T00:00:00.000Z') } },
      { id: 'middle', data: { title: 'Middle', pubDate: new Date('2024-02-01T00:00:00.000Z') } },
      { id: 'oldest', data: { title: 'Oldest', pubDate: new Date('2024-01-01T00:00:00.000Z') } },
    ];

    expect(getPostNeighbors(posts, 'middle')).toEqual({
      previous: posts[0],
      next: posts[2],
    });
  });

  it('uses null when a neighboring post does not exist', () => {
    const posts = [
      { id: 'newest', data: { title: 'Newest', pubDate: new Date('2024-03-01T00:00:00.000Z') } },
      { id: 'oldest', data: { title: 'Oldest', pubDate: new Date('2024-01-01T00:00:00.000Z') } },
    ];

    expect(getPostNeighbors(posts, 'newest')).toEqual({
      previous: null,
      next: posts[1],
    });
  });
});
```

- [ ] **Step 2: Add failing tests for TOC filtering**

Append to `tests/blog-utils.test.mjs`:

```js
describe('getTableOfContentsItems', () => {
  it('keeps h2 and h3 headings and omits the table of contents when fewer than two items exist', () => {
    expect(
      getTableOfContentsItems([
        { depth: 1, slug: 'title', text: 'Title' },
        { depth: 2, slug: 'install', text: 'Install' },
        { depth: 4, slug: 'deep', text: 'Deep' },
      ]),
    ).toEqual([]);
  });

  it('returns h2 and h3 headings when at least two eligible headings exist', () => {
    expect(
      getTableOfContentsItems([
        { depth: 2, slug: 'install', text: 'Install' },
        { depth: 3, slug: 'windows', text: 'Windows' },
        { depth: 4, slug: 'ignored', text: 'Ignored' },
      ]),
    ).toEqual([
      { depth: 2, slug: 'install', text: 'Install' },
      { depth: 3, slug: 'windows', text: 'Windows' },
    ]);
  });
});
```

- [ ] **Step 3: Add failing tests for code fence metadata parsing**

Create `tests/code-blocks.test.mjs`:

```js
import { describe, expect, it } from 'vitest';

import { parseCodeFenceMeta } from '../src/lib/blog.ts';

describe('parseCodeFenceMeta', () => {
  it('parses language and title from a code fence meta string', () => {
    expect(parseCodeFenceMeta('ts title="src/main.ts"')).toEqual({
      language: 'ts',
      title: 'src/main.ts',
      label: 'src/main.ts',
    });
  });

  it('falls back to the language when title is missing', () => {
    expect(parseCodeFenceMeta('bash')).toEqual({
      language: 'bash',
      title: null,
      label: 'bash',
    });
  });

  it('uses a generic label when language and title are missing', () => {
    expect(parseCodeFenceMeta('')).toEqual({
      language: null,
      title: null,
      label: 'code',
    });
  });
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```powershell
npm run test -- tests/blog-utils.test.mjs tests/code-blocks.test.mjs
```

Expected: tests fail because `getPostNeighbors`, `getTableOfContentsItems`, and `parseCodeFenceMeta` are not exported yet.

- [ ] **Step 5: Implement utility helpers**

Add to `src/lib/blog.ts`:

```ts
export type PostNeighbor = BlogPost | null;
export type PostNeighbors = { previous: PostNeighbor; next: PostNeighbor };
export type TocHeading = { depth: number; slug: string; text: string };
export type CodeFenceMeta = { language: string | null; title: string | null; label: string };

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
	const language = source.match(/^[^\s{]+/)?.[0] ?? null;
	const title = source.match(/title=(?:"([^"]+)"|'([^']+)')/)?.[1] ?? source.match(/title=(?:"([^"]+)"|'([^']+)')/)?.[2] ?? null;

	return {
		language,
		title,
		label: title ?? language ?? 'code',
	};
}
```

- [ ] **Step 6: Run tests and verify they pass**

Run:

```powershell
npm run test -- tests/blog-utils.test.mjs tests/code-blocks.test.mjs
```

Expected: all selected tests pass.

- [ ] **Step 7: Commit Task 1**

Run:

```powershell
git add src/lib/blog.ts tests/blog-utils.test.mjs tests/code-blocks.test.mjs
git commit -m "feat: add blog refresh utilities"
```

## Task 2: Build-Time Code Block Enhancement

**Files:**
- Create: `src/lib/rehype-code-blocks.mjs`
- Modify: `astro.config.mjs`
- Modify: `tests/site-shell.test.mjs`

- [ ] **Step 1: Add failing structural test for rehype plugin registration**

Append to `tests/site-shell.test.mjs`:

```js
  it('registers the code block rehype plugin for Markdown rendering', async () => {
    const config = await read('astro.config.mjs');
    const plugin = await read('src/lib/rehype-code-blocks.mjs');

    expect(config).toContain("import rehypeCodeBlocks from './src/lib/rehype-code-blocks.mjs'");
    expect(config).toContain('rehypePlugins: [rehypeCodeBlocks]');
    expect(plugin).toContain('code-block');
    expect(plugin).toContain('data-code-copy');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test -- tests/site-shell.test.mjs
```

Expected: fails because `src/lib/rehype-code-blocks.mjs` does not exist and config is not registered.

- [ ] **Step 3: Create the rehype plugin**

Create `src/lib/rehype-code-blocks.mjs`:

```js
import { parseCodeFenceMeta } from './blog.ts';

const textNode = (value) => ({ type: 'text', value });

function visit(node, visitor) {
	if (!node || typeof node !== 'object') {
		return;
	}

	visitor(node);

	if (Array.isArray(node.children)) {
		for (const child of node.children) {
			visit(child, visitor);
		}
	}
}

function readCodeText(codeNode) {
	return (codeNode.children ?? [])
		.filter((child) => child.type === 'text')
		.map((child) => child.value)
		.join('');
}

export default function rehypeCodeBlocks() {
	return (tree) => {
		visit(tree, (node) => {
			if (node.type !== 'element' || node.tagName !== 'pre') {
				return;
			}

			const codeNode = node.children?.find(
				(child) => child.type === 'element' && child.tagName === 'code',
			);

			if (!codeNode) {
				return;
			}

			const className = codeNode.properties?.className ?? [];
			const languageClass = Array.isArray(className)
				? className.find((name) => String(name).startsWith('language-'))
				: null;
			const language = languageClass ? String(languageClass).replace('language-', '') : null;
			const rawMeta = codeNode.data?.meta ?? language ?? '';
			const meta = parseCodeFenceMeta(rawMeta);
			const label = meta.title ?? meta.language ?? language ?? 'code';
			const codeText = readCodeText(codeNode);

			node.tagName = 'figure';
			node.properties = {
				className: ['code-block'],
				'data-language': meta.language ?? language ?? 'code',
			};
			node.children = [
				{
					type: 'element',
					tagName: 'figcaption',
					properties: { className: ['code-block__header'] },
					children: [
						{
							type: 'element',
							tagName: 'span',
							properties: { className: ['code-block__label'] },
							children: [textNode(label)],
						},
						{
							type: 'element',
							tagName: 'button',
							properties: {
								type: 'button',
								className: ['code-block__copy'],
								'data-code-copy': '',
								'data-code-text': codeText,
								'aria-label': `复制 ${label} 代码`,
							},
							children: [textNode('复制')],
						},
					],
				},
				{
					type: 'element',
					tagName: 'pre',
					properties: { className: ['code-block__pre'] },
					children: [codeNode],
				},
			];
		});
	};
}
```

- [ ] **Step 4: Register the plugin in Astro config**

Modify `astro.config.mjs`:

```js
import rehypeCodeBlocks from './src/lib/rehype-code-blocks.mjs';
```

Add inside `defineConfig`:

```js
	markdown: {
		rehypePlugins: [rehypeCodeBlocks],
		shikiConfig: {
			theme: 'one-dark-pro',
		},
	},
```

- [ ] **Step 5: Run tests and build**

Run:

```powershell
npm run test -- tests/site-shell.test.mjs tests/code-blocks.test.mjs
npm run build
```

Expected: tests pass and Astro builds without Markdown rendering errors.

- [ ] **Step 6: Commit Task 2**

Run:

```powershell
git add astro.config.mjs src/lib/rehype-code-blocks.mjs tests/site-shell.test.mjs
git commit -m "feat: enhance markdown code blocks"
```

## Task 3: Article TOC And Previous/Next Components

**Files:**
- Create: `src/components/TableOfContents.astro`
- Create: `src/components/PostNavigation.astro`
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/layouts/BlogPost.astro`
- Modify: `tests/site-shell.test.mjs`

- [ ] **Step 1: Add failing structural tests for article components**

Append to `tests/site-shell.test.mjs`:

```js
  it('wires article pages to table of contents and previous-next navigation', async () => {
    const route = await read('src/pages/posts/[slug].astro');
    const layout = await read('src/layouts/BlogPost.astro');

    expect(route).toContain('getPostNeighbors');
    expect(route).toContain('getTableOfContentsItems');
    expect(route).toContain('headings');
    expect(layout).toContain('TableOfContents');
    expect(layout).toContain('PostNavigation');
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
npm run test -- tests/site-shell.test.mjs
```

Expected: fails because the components and wiring are not present.

- [ ] **Step 3: Create `TableOfContents.astro`**

Create `src/components/TableOfContents.astro`:

```astro
---
import type { TocHeading } from '../lib/blog';

interface Props {
	items: TocHeading[];
}

const { items } = Astro.props;
---

{
	items.length > 0 && (
		<>
			<aside class="toc toc--desktop" aria-label="文章目录">
				<p class="toc__title">目录</p>
				<nav>
					<ul>
						{items.map((item) => (
							<li class={`toc__item toc__item--depth-${item.depth}`}>
								<a href={`#${item.slug}`}>{item.text}</a>
							</li>
						))}
					</ul>
				</nav>
			</aside>
			<details class="toc toc--mobile">
				<summary>目录</summary>
				<nav aria-label="文章目录">
					<ul>
						{items.map((item) => (
							<li class={`toc__item toc__item--depth-${item.depth}`}>
								<a href={`#${item.slug}`}>{item.text}</a>
							</li>
						))}
					</ul>
				</nav>
			</details>
		</>
	)
}
```

- [ ] **Step 4: Create `PostNavigation.astro`**

Create `src/components/PostNavigation.astro`:

```astro
---
import type { PostNeighbors } from '../lib/blog';
import FormattedDate from './FormattedDate.astro';

type NeighborPost = NonNullable<PostNeighbors['previous']>;

interface Props {
	previous: NeighborPost | null;
	next: NeighborPost | null;
}

const { previous, next } = Astro.props;
---

{
	(previous || next) && (
		<nav class="post-nav" aria-label="相邻文章">
			{previous && (
				<a class="post-nav__link post-nav__link--previous" href={`/posts/${previous.id}/`}>
					<span class="post-nav__label">上一篇</span>
					<span class="post-nav__title">{previous.data.title}</span>
					<span class="post-nav__date">
						<FormattedDate date={previous.data.pubDate} />
					</span>
				</a>
			)}
			{next && (
				<a class="post-nav__link post-nav__link--next" href={`/posts/${next.id}/`}>
					<span class="post-nav__label">下一篇</span>
					<span class="post-nav__title">{next.data.title}</span>
					<span class="post-nav__date">
						<FormattedDate date={next.data.pubDate} />
					</span>
				</a>
			)}
		</nav>
	)
}
```

- [ ] **Step 5: Wire article route data**

Modify `src/pages/posts/[slug].astro`:

```astro
---
import { type CollectionEntry, getCollection, render } from 'astro:content';
import BlogPost from '../../layouts/BlogPost.astro';
import { getPostNeighbors, getTableOfContentsItems, getVisiblePosts } from '../../lib/blog';

export async function getStaticPaths() {
	const posts = getVisiblePosts(await getCollection('blog'));

	return posts.map((post) => ({
		params: { slug: post.id },
		props: {
			post,
			neighbors: getPostNeighbors(posts, post.id),
		},
	}));
}

type Props = {
	post: CollectionEntry<'blog'>;
	neighbors: ReturnType<typeof getPostNeighbors>;
};

const { post, neighbors } = Astro.props;
const { Content, headings } = await render(post);
const tocItems = getTableOfContentsItems(headings);
---

<BlogPost {...post.data} tocItems={tocItems} previous={neighbors.previous} next={neighbors.next}>
	<Content />
</BlogPost>
```

- [ ] **Step 6: Update article layout props and copy script**

Modify `src/layouts/BlogPost.astro` imports and props:

```astro
---
import type { CollectionEntry } from 'astro:content';
import FormattedDate from '../components/FormattedDate.astro';
import PostNavigation from '../components/PostNavigation.astro';
import TableOfContents from '../components/TableOfContents.astro';
import { encodeHrefSegment, type PostNeighbors, type TocHeading } from '../lib/blog';
import BaseLayout from './BaseLayout.astro';

type Props = CollectionEntry<'blog'>['data'] & {
	tocItems?: TocHeading[];
	previous?: PostNeighbors['previous'];
	next?: PostNeighbors['next'];
};

const {
	title,
	description,
	pubDate,
	updatedDate,
	categories,
	tags,
	tocItems = [],
	previous = null,
	next = null,
} = Astro.props;
---
```

Replace the body with:

```astro
<BaseLayout title={title} description={description}>
	<div class="post-shell">
		<article class="post">
			<header class="post-header">
				<p class="post-date">
					发布于 <FormattedDate date={pubDate} />
					{
						updatedDate && (
							<>
								<span aria-hidden="true"> · </span>
								更新于 <FormattedDate date={updatedDate} />
							</>
						)
					}
				</p>
				<h1>{title}</h1>
				{
					(categories.length > 0 || tags.length > 0) && (
						<div class="post-taxonomy">
							{categories.map((category) => (
								<a href={`/categories/${encodeHrefSegment(category)}/`}>{category}</a>
							))}
							{tags.map((tag) => (
								<a href={`/tags/${encodeHrefSegment(tag)}/`}>#{tag}</a>
							))}
						</div>
					)
				}
			</header>
			<TableOfContents items={tocItems} />
			<div class="prose">
				<slot />
			</div>
			<PostNavigation previous={previous} next={next} />
		</article>
		<TableOfContents items={tocItems} />
	</div>
	<script is:inline>
		document.addEventListener('click', async (event) => {
			const button = event.target.closest('[data-code-copy]');
			if (!button) return;

			const text = button.getAttribute('data-code-text') ?? '';
			const original = button.textContent;

			try {
				await navigator.clipboard.writeText(text);
				button.textContent = '已复制';
				window.setTimeout(() => {
					button.textContent = original;
				}, 1600);
			} catch {
				button.textContent = '复制失败';
				window.setTimeout(() => {
					button.textContent = original;
				}, 1600);
			}
		});
	</script>
</BaseLayout>
```

- [ ] **Step 7: Run tests and build**

Run:

```powershell
npm run test -- tests/site-shell.test.mjs tests/blog-utils.test.mjs
npm run build
```

Expected: tests pass and all article pages build.

- [ ] **Step 8: Commit Task 3**

Run:

```powershell
git add src/components/TableOfContents.astro src/components/PostNavigation.astro src/pages/posts/[slug].astro src/layouts/BlogPost.astro tests/site-shell.test.mjs
git commit -m "feat: add article navigation aids"
```

## Task 4: Visual Refresh Styles And Listing Polish

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/Header.astro`
- Modify: `src/components/Footer.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/pages/posts/index.astro`
- Modify: `src/pages/archives/index.astro`
- Modify: `src/pages/tags/index.astro`
- Modify: `src/pages/categories/index.astro`

- [ ] **Step 1: Refresh design tokens and global page shell**

In `src/styles/global.css`, replace the `:root`, `body`, and `main` foundation with a light knowledge-base palette:

```css
:root {
	--accent: #1d5fd1;
	--accent-dark: #143f8d;
	--surface: #ffffff;
	--surface-muted: #f5f7fb;
	--surface-subtle: #eef2f8;
	--border: #d8dee9;
	--text: #1d2433;
	--text-muted: #647084;
	--text-strong: #101624;
	--code-bg: #282c34;
	--code-header: #21252b;
	--code-border: #3a3f4b;
	--content-width: 1080px;
	--article-width: 760px;
}

body {
	font-family: var(--font-atkinson);
	margin: 0;
	padding: 0;
	text-align: left;
	background: var(--surface-muted);
	word-wrap: break-word;
	overflow-wrap: break-word;
	color: var(--text);
	font-size: 18px;
	line-height: 1.75;
}

main {
	width: min(var(--content-width), 100%);
	margin: 0 auto;
	padding: 2.5rem 1rem;
}
```

- [ ] **Step 2: Add One Dark code block styles**

Append to `src/styles/global.css`:

```css
.code-block {
	margin: 1.5rem 0;
	overflow: hidden;
	border: 1px solid var(--code-border);
	border-radius: 8px;
	background: var(--code-bg);
}

.code-block__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1rem;
	padding: 0.55rem 0.75rem;
	background: var(--code-header);
	border-bottom: 1px solid var(--code-border);
	color: #abb2bf;
	font-size: 0.82rem;
}

.code-block__label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}

.code-block__copy {
	flex: 0 0 auto;
	border: 1px solid #4b5263;
	border-radius: 6px;
	padding: 0.2rem 0.55rem;
	background: #2f343f;
	color: #d7dae0;
	cursor: pointer;
	font: inherit;
}

.code-block__copy:hover,
.code-block__copy:focus-visible {
	border-color: #61afef;
	color: #ffffff;
}

.code-block__pre {
	margin: 0;
	padding: 1rem;
	overflow-x: auto;
	background: var(--code-bg);
	border-radius: 0;
}
```

- [ ] **Step 3: Add article layout, TOC, and post navigation styles**

Append to `src/styles/global.css`:

```css
.post-shell {
	display: grid;
	grid-template-columns: minmax(0, var(--article-width)) 240px;
	gap: 3rem;
	align-items: start;
}

.post {
	min-width: 0;
}

.toc {
	border: 1px solid var(--border);
	border-radius: 8px;
	background: var(--surface);
}

.toc--desktop {
	position: sticky;
	top: 1rem;
	padding: 1rem;
}

.post > .toc--desktop {
	display: none;
}

.toc--mobile {
	display: none;
	margin-bottom: 1.5rem;
	padding: 0.75rem 1rem;
}

.toc__title,
.toc summary {
	margin: 0 0 0.75rem;
	color: var(--text-strong);
	font-weight: 700;
}

.toc ul {
	margin: 0;
	padding: 0;
	list-style: none;
}

.toc a {
	display: block;
	padding: 0.2rem 0;
	color: var(--text-muted);
	text-decoration: none;
	font-size: 0.92rem;
	line-height: 1.45;
}

.toc a:hover,
.toc a:focus-visible {
	color: var(--accent);
}

.toc__item--depth-3 {
	padding-left: 0.85rem;
}

.post-nav {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 1rem;
	margin-top: 2.5rem;
}

.post-nav__link {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 1rem;
	border: 1px solid var(--border);
	border-radius: 8px;
	background: var(--surface);
	text-decoration: none;
}

.post-nav__label,
.post-nav__date {
	color: var(--text-muted);
	font-size: 0.85rem;
}

.post-nav__title {
	color: var(--text-strong);
	font-weight: 700;
}

@media (max-width: 980px) {
	.post-shell {
		display: block;
	}

	.post-shell > .toc--desktop {
		display: none;
	}

	.post > .toc--mobile {
		display: block;
	}
}

@media (max-width: 640px) {
	.post-nav {
		grid-template-columns: 1fr;
	}
}
```

- [ ] **Step 4: Refresh header and footer styles**

Modify `src/components/Header.astro` styles to use the new variables:

```css
header {
	margin: 0;
	padding: 0 1rem;
	background: rgba(255, 255, 255, 0.92);
	border-bottom: 1px solid var(--border);
}
```

Modify `src/components/Footer.astro` markup to include useful links:

```astro
<footer>
	<p>&copy; {today.getFullYear()} {SITE_AUTHOR}</p>
	<nav aria-label="页脚链接">
		<a href="/rss.xml">RSS</a>
		<a href="https://github.com/Blackwood416/Blackwood416.github.io">GitHub</a>
	</nav>
</footer>
```

- [ ] **Step 5: Polish home and listing pages with existing class names**

Keep the current Astro data flow. Use existing classes such as `.page-header`, `.link-list`, `.post-list`, `.post-card`, `.post-meta`, `.post-taxonomy`, `.taxonomy-list`, and `.archive-group`, then update `src/styles/global.css` so they read as a cohesive knowledge-base UI:

```css
.page-header {
	margin-bottom: 2rem;
	padding-bottom: 1.5rem;
	border-bottom: 1px solid var(--border);
}

.page-header p {
	color: var(--text-muted);
}

.link-list a,
.post-taxonomy a,
.taxonomy-list a {
	display: inline-block;
	border: 1px solid var(--border);
	border-radius: 6px;
	background: var(--surface);
	text-decoration: none;
}

.link-list a {
	padding: 0.35rem 0.7rem;
}

.post-card {
	padding: 1rem;
	border: 1px solid var(--border);
	border-radius: 8px;
	background: var(--surface);
}
```

- [ ] **Step 6: Run build and inspect key pages locally**

Run:

```powershell
npm run build
```

Then start preview:

```powershell
npm run preview -- --host 127.0.0.1
```

Expected: build succeeds and the preview server prints a localhost URL. Manually inspect home, posts, archives, tags, categories, and one long code-heavy post.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add src/styles/global.css src/components/Header.astro src/components/Footer.astro src/pages/index.astro src/pages/posts/index.astro src/pages/archives/index.astro src/pages/tags/index.astro src/pages/categories/index.astro
git commit -m "feat: refresh blog visual system"
```

## Task 5: Final Verification And Deployment Notes

**Files:**
- Modify only if verification reveals an issue.

- [ ] **Step 1: Run the full test suite**

Run:

```powershell
npm run test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run the production build**

Run:

```powershell
npm run build
```

Expected: Astro build succeeds and Pagefind indexes pages.

- [ ] **Step 3: Check git state**

Run:

```powershell
git status --short
```

Expected: no uncommitted changes. If verification fixes were needed, commit them with:

```powershell
git add <changed-files>
git commit -m "fix: polish frontend refresh"
```

- [ ] **Step 4: Report completion**

Summarize:

- Commits created.
- Tests and build results.
- Any visual checks performed.
- Any follow-up ideas intentionally left out, such as dark mode, search filters, and series pages.

## Self-Review

- Spec coverage: this plan covers visual refresh, One Dark code blocks, TOC, previous/next navigation, responsive behavior, accessibility basics, and build/test verification.
- Placeholder scan: the plan contains no red-flag placeholder tokens or deferred implementation notes.
- Type consistency: helper names are consistently `getPostNeighbors`, `getTableOfContentsItems`, and `parseCodeFenceMeta`; component prop names are consistently `tocItems`, `previous`, and `next`.
