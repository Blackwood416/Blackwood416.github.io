import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';

const read = (path) => fs.readFile(path, 'utf8');

describe('production site shell', () => {
  it('uses the production site URL for Astro output', async () => {
    const config = await read('astro.config.mjs');

    expect(config).toContain("site: 'https://blog.blackwood.cv'");
    expect(config).not.toContain('https://example.com');
  });

  it('loads Pagefind from built static assets without importing runtime packages', async () => {
    const searchPage = await read('src/pages/search.astro');

    expect(searchPage).toContain('/pagefind/pagefind-ui.css');
    expect(searchPage).toContain('/pagefind/pagefind-ui.js');
    expect(searchPage).toContain('new PagefindUI');
    expect(searchPage).toContain('<noscript>');
    expect(searchPage).not.toContain("from 'pagefind");
    expect(searchPage).not.toContain('from "pagefind');
  });

  it('keeps RSS on visible /posts/ URLs', async () => {
    const rssPage = await read('src/pages/rss.xml.js');

    expect(rssPage).toContain('getVisiblePosts');
    expect(rssPage).toContain('link: `/posts/${post.id}/`');
    expect(rssPage).not.toContain('/blog/');
  });

  it('uses site-relative metadata without starter placeholder images', async () => {
    const baseHead = await read('src/components/BaseHead.astro');

    expect(baseHead).toContain('const canonicalURL = new URL(Astro.url.pathname, Astro.site);');
    expect(baseHead).toContain("new URL('rss.xml', Astro.site)");
    expect(baseHead).toContain("new URL('sitemap-index.xml', Astro.site)");
    expect(baseHead).not.toContain('blog-placeholder');
    expect(baseHead).not.toContain('ImageMetadata');
  });
});
