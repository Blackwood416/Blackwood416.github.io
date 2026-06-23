# AGENTS.md

This repository is Blackwood's Astro blog, migrated from the previous Hexo source at `F:\hexo-blogs`.

The production site is `https://blog.blackwood.cv`, hosted on Cloudflare Pages project `blackwood-blog`.

## Current State

- Primary branch: `master`.
- Remote: `origin` points to `https://github.com/Blackwood416/Blackwood416.github.io.git`.
- Production domain: `https://blog.blackwood.cv`.
- Current deployment path is Cloudflare Pages direct upload with Wrangler.
- The site has already been migrated from Hexo; do not preserve old GitHub Pages URL compatibility unless the user explicitly asks.
- The current frontend is intentionally a light technical knowledge-base style with One Dark inspired code blocks.

## Commands

Run commands from the repository root.

```sh
npm install
npm run dev
npm run test
npm run build
npm run preview
```

Important scripts:

- `npm run dev`: starts Astro with `--host`.
- `npm run test`: runs Vitest coverage for migration helpers, blog utilities, code block transforms, and shell structure.
- `npm run build`: runs Astro build and then Pagefind indexing.
- `npm run build:astro`: builds only the static Astro site.
- `npm run build:search`: generates Pagefind assets under `dist/pagefind`.
- `npm run migrate:hexo`: re-runs the Hexo migration script.

## Project Map

- `src/content/blog/`: migrated blog posts.
- `src/content/pages/about.md`: migrated about page content.
- `src/content.config.ts`: content schema for posts and pages.
- `src/lib/blog.ts`: post sorting, taxonomy counting, archive grouping, TOC items, previous/next neighbors, and code fence metadata parsing.
- `src/lib/remark-code-block-meta.ts`: captures markdown code fence metadata before Astro/Shiki processing.
- `src/lib/rehype-code-blocks.ts`: wraps code blocks in editor-like markup and copy buttons.
- `src/layouts/BaseLayout.astro`: shared site shell.
- `src/layouts/BlogPost.astro`: article layout, TOC placement, previous/next navigation, and code-copy runtime script.
- `src/components/TableOfContents.astro`: desktop and mobile article TOC.
- `src/components/PostNavigation.astro`: previous/next article links.
- `src/styles/global.css`: main visual system, prose styles, taxonomy chips, TOC, post cards, and One Dark code block styling.
- `scripts/migrate-hexo.mjs`: Hexo-to-Astro content migration.
- `docs/deployment/cloudflare-pages.md`: Cloudflare Pages, DNS, and domain notes.
- `docs/superpowers/`: planning/spec artifacts from the migration and frontend refresh.

## Deployment

Build first:

```sh
npm run build
```

Direct upload to Cloudflare Pages:

```sh
npx wrangler pages deploy dist --project-name blackwood-blog --branch production
```

After deployment, verify at least:

```sh
curl https://blog.blackwood.cv/
curl https://blog.blackwood.cv/search/
curl https://blog.blackwood.cv/pagefind/pagefind.js
```

Useful online markers for the refreshed version:

- CSS contains `--code-bg: #282c34`.
- Article pages contain `.toc`, `.post-nav`, and `.code-block`.
- Search page loads `/pagefind/pagefind-ui.js` and `/pagefind/pagefind.js` returns HTTP 200.

## Git And Generated Files

Do not commit generated or local-only folders:

- `.astro/`
- `.superpowers/`
- `.worktrees/`
- `.wrangler/`
- `dist/`
- `node_modules/`

They are intentionally ignored.

Before handing work back, run:

```sh
npm run test
npm run build
git status --short --branch
```

If pushing a release:

```sh
git push origin master
```

Note: pushing `master` to GitHub does not guarantee Cloudflare production has refreshed unless Cloudflare is connected to that branch. Direct Wrangler upload is currently the reliable deployment path.

## Known Non-Blocking Warnings

Current builds may emit these warnings:

- Astro warns that `markdown.remarkPlugins`, `markdown.rehypePlugins`, and `markdown.remarkRehype` are deprecated and should eventually move to `unified(...)` from `@astrojs/markdown-remark`.
- Shiki may warn that existing language labels such as `octave`, `assembly`, or `gdb` are unknown and fall back to plaintext.
- Pagefind recommends its newer Component UI instead of the Default UI.
- `npm install` may report low or moderate audit findings. Do not run `npm audit fix --force` without user approval because it can introduce breaking dependency changes.

## Implementation Notes

- Keep raw taxonomy values for Astro route params; only use `encodeHrefSegment()` when constructing hrefs.
- `getVisiblePosts()` filters drafts and sorts posts newest first.
- TOC is intentionally shown only when an article has at least two h2/h3 headings.
- Code fence metadata is split across remark/rehype/runtime handling because Astro and Shiki transform code blocks during markdown rendering.
- The runtime script in `BlogPost.astro` removes `[data-code-block-meta]` markers after applying labels and aria text.
- Prefer small, focused changes with tests in `tests/` for shared behavior.
- Keep UI changes consistent with the current restrained knowledge-base direction unless the user asks for a stronger redesign.
