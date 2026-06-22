# Blackwood's Blogs

Astro-based personal blog migrated from the previous Hexo source in `F:\hexo-blogs`.

## Commands

| Command | Action |
| :-- | :-- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the local dev server |
| `npm run test` | Run migration and site utility tests |
| `npm run build` | Build Astro output and Pagefind search index |
| `npm run build:astro` | Build only the Astro static site |
| `npm run build:search` | Generate Pagefind assets under `dist/pagefind` |
| `npm run preview` | Preview the built site locally |
| `npm run migrate:hexo` | Re-run the Hexo content migration |

## Content

- Blog posts live in `src/content/blog`.
- The migrated about page lives in `src/content/pages/about.md`.
- The source migration script is `scripts/migrate-hexo.mjs`.
- Missing Hexo-relative images are rewritten as quoted notes during migration and reported in the migration summary.

## Deployment

The production site is configured for `https://blog.blackwood.cv`.

Cloudflare Pages should use:

- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22.12.0` or newer

See `docs/deployment/cloudflare-pages.md` for the Cloudflare Pages and Spaceship DNS setup checklist.
