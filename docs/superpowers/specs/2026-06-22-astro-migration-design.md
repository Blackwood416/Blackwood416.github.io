# Astro Blog Migration Design

Date: 2026-06-22

## Goal

Migrate the existing Hexo blog from `F:\hexo-blogs` into this Astro project and prepare it for deployment through Cloudflare Pages at `https://blog.blackwood.cv`.

This first phase prioritizes a correct migration and working deployment over custom frontend polish. The site should be clean, navigable, and maintainable, but deeper visual design will be handled later.

## Source And Target

- Source repository: `F:\hexo-blogs`
- Source remote: `https://github.com/Blackwood416/Blackwood416.github.io`
- Source branch observed locally: `hexo`
- Target repository: current Astro project in `E:\astro-blogs`
- Final GitHub repository: `Blackwood416/Blackwood416.github.io`
- Final production domain: `blog.blackwood.cv`

## Scope

Included in the first phase:

- Migrate published posts from `F:\hexo-blogs\source\_posts`.
- Migrate the About page from `F:\hexo-blogs\source\about\index.md`.
- Exclude drafts from `F:\hexo-blogs\source\_drafts`.
- Replace Astro starter content with migrated content.
- Provide basic pages for posts, tags, categories, archives, search, RSS, and sitemap.
- Configure the Astro site URL for `https://blog.blackwood.cv`.
- Prepare Cloudflare Pages deployment documentation/configuration.
- Configure `blackwood.cv` DNS to be managed by Cloudflare, with Spaceship kept as registrar.

Out of scope for this phase:

- Custom visual redesign beyond a simple readable baseline.
- Comment system.
- Visitor analytics.
- Backward-compatible Hexo URL redirects.
- Search engine migration or index preservation.
- Downloading and self-hosting all remote images.
- Migrating drafts into the live site.

## Information Architecture

Routes:

- `/` - basic homepage with links to the main indexes and recent posts.
- `/posts/` - all posts, sorted newest first.
- `/posts/<slug>/` - individual post pages. The slug is the original Markdown filename without extension.
- `/tags/` - tag index with counts.
- `/tags/<tag>/` - posts for a tag.
- `/categories/` - category index with counts.
- `/categories/<category>/` - posts for a category.
- `/archives/` - posts grouped by year and month.
- `/search/` - local search page.
- `/about/` - migrated About page.
- `/rss.xml` - RSS feed.
- `/sitemap-index.xml` and generated sitemap files - sitemap output from Astro integration.

## Content Model

Use an Astro content collection named `blog`.

Post frontmatter after migration:

- `title: string`
- `description: string`
- `pubDate: Date`
- `updatedDate?: Date`
- `tags: string[]`
- `categories: string[]`
- `draft: boolean`

Field mapping from Hexo:

- `title` maps to `title`.
- `date` maps to `pubDate`.
- `tags` maps to `tags`.
- `categories` maps to `categories`.
- Missing or empty `tags` becomes `[]`.
- Missing or empty `categories` becomes `[]`.
- `description` is generated from the first usable paragraph of the Markdown body.
- `draft` is set to `false` for all migrated published posts.

## Migration Rules

Use an automated migration script or one-time tool rather than manual copying.

The migration should:

- Read all Markdown files from `F:\hexo-blogs\source\_posts`.
- Parse frontmatter using a structured parser.
- Write converted Markdown files to `src/content/blog`.
- Preserve the original filename as the route slug.
- Remove Astro starter sample posts.
- Preserve the article body as much as possible.
- Remove a duplicate first body heading when it exactly repeats the frontmatter title.
- Keep remote image URLs unchanged.
- Report relative image references whose files cannot be found in the Hexo source.
- Convert singleton tag/category strings into arrays.
- Preserve Chinese text and timestamps.

The About page should be migrated into Astro's `/about/` route and should preserve the existing content:

- Title: `关于`
- Body content from `F:\hexo-blogs\source\about\index.md`

## Search

Use Pagefind for local static search in the first phase.

The search implementation should:

- Build after Astro produces `dist`.
- Index the generated static HTML.
- Expose a simple `/search/` page.
- Avoid any hosted search service or backend API.

The search UI can be minimal. Frontend polish is deferred.

## Deployment

Deploy as a static Astro site on Cloudflare Pages.

Cloudflare Pages settings:

- Git provider: GitHub
- Repository: `Blackwood416/Blackwood416.github.io`
- Production branch: `main`
- Build command: `npm run build`
- Output directory: `dist`
- Custom domain: `blog.blackwood.cv`

Astro settings:

- `site` should be `https://blog.blackwood.cv`.
- No Cloudflare adapter is needed for a static Astro site.

DNS plan:

- Add `blackwood.cv` as a Cloudflare zone.
- Change the domain's nameservers in Spaceship to the Cloudflare-provided nameservers.
- Add or let Cloudflare Pages create the DNS record for `blog.blackwood.cv`.
- Allow for DNS propagation time after changing nameservers.

Reference documentation:

- Astro Cloudflare deployment: https://docs.astro.build/en/guides/deploy/cloudflare/
- Cloudflare Pages Astro guide: https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Spaceship custom nameservers: https://www.spaceship.com/knowledgebase/connect-domain-custom-nameservers/

## Verification

Local verification:

- Run `npm run build`.
- Run a local preview or static server against `dist`.
- Confirm the migrated post count matches the Hexo published post count.
- Confirm `/about/` renders.
- Confirm `/posts/`, tag pages, category pages, archive pages, RSS, sitemap, and search page exist.
- Spot check several migrated posts:
  - A long technical article.
  - An article with tables.
  - An article with code blocks.
  - An article with remote images.
  - An article with empty tags or categories.

Deployment verification:

- Confirm Cloudflare Pages production deployment succeeds.
- Confirm `https://blog.blackwood.cv` resolves after DNS propagation.
- Confirm HTTPS certificate is active.
- Confirm RSS and sitemap are reachable on the production domain.
- Confirm search works on production.

## Risks And Mitigations

- Some Markdown may contain Hexo-specific syntax. Mitigation: search for Hexo tag syntax and fix or report any instances before build completion.
- Some relative images may be missing. Mitigation: report them during migration and leave a clear list for follow-up.
- DNS propagation can take time. Mitigation: treat domain activation as a separate deployment verification step.
- Pagefind can fail if not run after the Astro build. Mitigation: make the production build script run Astro first and Pagefind second.
- Existing uncommitted changes may be present in the target repository. Mitigation: do not overwrite or revert unrelated changes.

## Acceptance Criteria

The first phase is complete when:

- The Astro project builds successfully.
- Published Hexo posts are available at `/posts/<slug>/`.
- The About page is available at `/about/`.
- Tags, categories, archives, RSS, sitemap, and search are functional.
- No starter sample posts remain.
- Cloudflare Pages can deploy the site from GitHub.
- `blog.blackwood.cv` is configured as the intended production domain.
