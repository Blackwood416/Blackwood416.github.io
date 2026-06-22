# Blog Frontend Refresh Design

Date: 2026-06-22

## Context

The Hexo-to-Astro migration is already deployed to Cloudflare Pages at `https://blog.blackwood.cv/`. The current Astro site is functionally complete, with posts, archives, tags, categories, search, RSS, and sitemap working. The visual layer is still close to the Astro starter: clean and readable, but sparse.

The next iteration should enrich the frontend slightly, improve the reading experience for technical notes, and add a small set of article-page features without turning the site into a large redesign project.

## Goals

- Give the site a more cohesive technical knowledge-base feel.
- Keep the site primarily content-first, readable, and lightweight.
- Add a One Dark inspired code-block experience for technical posts.
- Add an article table of contents for long posts.
- Add previous/next post navigation to article pages.
- Refresh the basic visual treatment of the home page, post lists, archive, tags, categories, header, and footer.
- Preserve all migrated posts without requiring bulk content rewrites.

## Non-Goals

- No full personal landing page redesign.
- No site-wide dark mode in this iteration.
- No comments, analytics dashboard, or visitor tracking.
- No series system or knowledge-map pages in this iteration.
- No complex active-heading scroll spy for the first table-of-contents version.
- No search filtering redesign beyond keeping the current search entry visible and consistent.

## Recommended Direction

Use a light technical knowledge-base foundation with One Dark code modules.

The page shell remains light, calm, and readable for Chinese long-form writing. Visual richness comes from better spacing, clearer hierarchy, taxonomy chips, article metadata, subtle borders, and stronger list layouts. Code blocks become the main dark visual element: each one should feel like a compact editor panel using One Dark inspired colors.

This keeps the site practical and durable. It also lets the code experience carry a stronger technical personality without making the whole blog visually heavy.

Google Stitch can be used later as a visual reference tool for the home page and article page, but this written spec is the source of truth for implementation.

## Information Architecture

### Header

The header should feel like compact tool navigation:

- Site name links to the home page.
- Navigation includes posts, archives, tags, categories, search, and about.
- The active section should be visually clear.
- On small screens, navigation must wrap or collapse without overlapping text.

### Home Page

The home page should become a stronger content entry point:

- Keep the site title and short description.
- Present primary entry links for posts, archives, tags, categories, and search.
- Show recent posts with date, category or tags when available, and description.
- Avoid a marketing hero. The home page should behave like the front door to a technical notebook.

### Listing Pages

Posts, archives, tags, and categories should share a consistent visual language:

- A clear page header with title and count or short helper text.
- Post list items with stronger hierarchy for title, date, taxonomy, and description.
- Taxonomy chips with consistent shape, color, hover, and focus states.
- Archive groups should read as a simple timeline grouped by year and month.

### Footer

The footer remains light but more useful:

- Copyright and author.
- RSS link.
- GitHub or repository link if available in site constants.
- Keep the footer quiet; it should not become a second navigation bar.

## Article Page

The article page is the priority surface for this iteration.

### Layout

- The main content column remains optimized for reading.
- Desktop layout includes a right-side table of contents.
- Mobile layout places the table of contents near the top of the article inside a collapsed `<details>` element.
- Article metadata remains above the title or directly below it, with publication date, updated date, categories, and tags.
- Article content should have improved typography for headings, paragraphs, blockquotes, tables, images, inline code, and lists.

### Table Of Contents

The table of contents is generated from Markdown headings:

- Include `h2` and `h3`.
- Exclude the article title.
- Use stable generated heading IDs from Astro's Markdown pipeline.
- On desktop, display the TOC in a right-side sticky area.
- On mobile, display it as a collapsed details block before the article body.
- First version does not need active-heading highlighting.
- If an article has fewer than two eligible headings, omit the TOC.

### Previous And Next Navigation

Article pages include previous/next navigation at the bottom:

- Posts are ordered by publication date descending, matching the rest of the blog.
- The newer neighboring post is labeled `上一篇`.
- The older neighboring post is labeled `下一篇`.
- If one side is missing, show only the available side.
- Navigation should include the neighboring post title and optionally its date.

## Code Block Experience

Code blocks should be rendered as One Dark inspired editor panels.

### Behavior

- Each code block has a header bar.
- If the Markdown fence includes a title, show that title in the header.
- If the fence has no title, show the language label.
- If neither title nor language exists, show a generic `code` label.
- Include a copy button in the header.
- Copying should copy only the code text, not the title or button label.
- After copying, the button should briefly display a copied state.
- If JavaScript fails, code remains readable and selectable.
- Code blocks must scroll horizontally instead of overflowing the page.

### Markdown Authoring

Existing posts keep working as-is.

New or edited posts may use an optional title syntax:

````markdown
```ts title="src/main.ts"
console.log('hello');
```
````

The implementation should support this style without requiring every migrated post to be updated.

### Visual Style

- Use One Dark inspired colors for code background, text, comments, keywords, strings, and punctuation.
- Header bar should feel like a small editor toolbar, not a decorative card.
- Keep border radius at or below 8px.
- Buttons use clear hover and focus states.
- The code font should be monospace and comfortable for mixed command/code snippets.

## Technical Design

### Markdown Rendering

Use Astro's Markdown/Rehype pipeline to transform code blocks during build:

- Parse code fence metadata for `title="..."`.
- Preserve language classes for syntax highlighting.
- Wrap code blocks in semantic markup that includes header, label, copy button, and scrollable code body.
- Avoid browser-side DOM guessing for the initial structure.

This keeps generated HTML predictable and easier to test.

### Components

Expected component-level changes:

- `BlogPost.astro`: article layout, TOC rendering, previous/next navigation slots or props.
- New TOC component: renders desktop and mobile variants from heading data.
- New post navigation component: renders previous/next links.
- Code block enhancement utilities or Rehype plugin: handles title metadata and wrapper markup.
- `Header.astro` and `Footer.astro`: visual refresh and link metadata.
- Listing pages and global styles: shared post-list, taxonomy, archive, and prose styles.

### Data Flow

- Blog posts continue to come from the `blog` content collection.
- Existing `getVisiblePosts()` remains the canonical ordering helper.
- Previous/next navigation is derived from the same visible post list.
- TOC data comes from the rendered Markdown headings available to the post page.
- Code block metadata comes from Markdown fence info strings at build time.

### Accessibility

- Copy buttons must have accessible labels.
- Keyboard focus states must be visible for navigation, taxonomy chips, TOC links, and code copy buttons.
- The mobile TOC uses native `<details>`/`<summary>` behavior.
- Color contrast should remain readable in light UI and dark code blocks.
- Header navigation must not overlap or trap focus on mobile.

### Responsive Behavior

- Desktop: content column plus sticky right-side TOC.
- Tablet and mobile: single column; TOC appears before content as a collapsed details block.
- Code blocks retain horizontal scrolling on narrow screens.
- Post list text, chips, and buttons must wrap cleanly.

## Testing And Verification

Run automated verification:

- `npm run test`
- `npm run build`

Add or update focused tests for:

- Previous/next post ordering.
- TOC omission when there are too few headings.
- Code block metadata parsing for title, language fallback, and generic fallback.

Do manual visual checks with local preview:

- Home page.
- A short article.
- A long article with multiple headings.
- An article with many code blocks.
- Posts page, archives page, tags page, categories page.
- Mobile-width viewport for header wrapping, TOC details, and code scrolling.

## Scope Boundary

This design is intentionally one implementation cycle. It should leave the site with a stronger technical-blog foundation and a better article reading experience, while keeping larger knowledge-organization features for a later spec.
