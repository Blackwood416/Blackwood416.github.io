import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
import matter from 'gray-matter';

import {
  extractDescription,
  findRelativeImageReferences,
  migrateHexo,
  normalizeList,
  removeDuplicateTitleHeading,
} from '../scripts/migrate-hexo.mjs';

describe('normalizeList', () => {
  it('returns an empty list for missing or empty values', () => {
    expect(normalizeList(undefined)).toEqual([]);
    expect(normalizeList(null)).toEqual([]);
    expect(normalizeList('')).toEqual([]);
  });

  it('wraps a non-empty string in a list', () => {
    expect(normalizeList('ASP.NET NativeAOT')).toEqual(['ASP.NET NativeAOT']);
  });

  it('trims array values and drops empty values', () => {
    expect(normalizeList([' Unity ', '', '开发'])).toEqual(['Unity', '开发']);
  });
});

describe('removeDuplicateTitleHeading', () => {
  it('removes a leading H1 when it exactly matches the title', () => {
    const markdown = '# 算法学习日志 01\n\n正文第一段。';

    expect(removeDuplicateTitleHeading(markdown, '算法学习日志 01')).toBe('正文第一段。');
  });

  it('keeps a different first heading', () => {
    const markdown = '# 算法学习日志 02\n\n正文第一段。';

    expect(removeDuplicateTitleHeading(markdown, '算法学习日志 01')).toBe(markdown);
  });
});

describe('extractDescription', () => {
  it('skips headings and image-only paragraphs, then strips readable paragraph markdown', () => {
    const markdown = [
      '# Post Title',
      '',
      '![cover](cover.jpg)',
      '',
      '这是 [第一段](https://example.com)，包含 **重点** 和 _强调_。',
      '',
      '第二段。',
    ].join('\n');

    expect(extractDescription(markdown)).toBe('这是 第一段，包含 重点 和 强调。');
  });
});

describe('findRelativeImageReferences', () => {
  it('returns only relative Markdown image references', () => {
    const markdown = [
      '![local](images/local.png)',
      '![remote](https://example.com/remote.png)',
      '![data](data:image/png;base64,abc)',
      '![root](/images/root.png)',
      '![hash](#image-anchor)',
      '![sibling](../sibling.jpg "Caption")',
    ].join('\n');

    expect(findRelativeImageReferences(markdown)).toEqual([
      { alt: 'local', src: 'images/local.png' },
      { alt: 'sibling', src: '../sibling.jpg' },
    ]);
  });
});

describe('migrateHexo', () => {
  it('migrates from file URL roots deterministically while preserving non-Markdown content files', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'hexo-migration-'));
    const hexoRoot = path.join(tempRoot, 'hexo');
    const projectRoot = path.join(tempRoot, 'astro');
    const sourcePostsDir = path.join(hexoRoot, 'source', '_posts');
    const sourceAboutDir = path.join(hexoRoot, 'source', 'about');
    const outputBlogDir = path.join(projectRoot, 'src', 'content', 'blog');
    const sourcePostPath = path.join(sourcePostsDir, 'sample-post.md');

    await fs.mkdir(sourcePostsDir, { recursive: true });
    await fs.mkdir(sourceAboutDir, { recursive: true });
    await fs.mkdir(outputBlogDir, { recursive: true });
    await fs.writeFile(path.join(outputBlogDir, 'old-post.md'), 'remove me', 'utf8');
    await fs.writeFile(path.join(outputBlogDir, 'notes.txt'), 'keep me', 'utf8');
    await fs.writeFile(
      sourcePostPath,
      [
        '---',
        'title: Sample Post',
        'tags:',
        '  - Astro',
        '  - Migration',
        'categories: Dev',
        '---',
        '',
        '# Sample Post',
        '',
        'Readable paragraph with **markdown**.',
      ].join('\n'),
      'utf8',
    );
    await fs.writeFile(
      path.join(sourceAboutDir, 'index.md'),
      ['---', 'title: About Me', '---', '', '# About Me', '', 'About body.'].join('\n'),
      'utf8',
    );

    const stableDate = new Date('2024-01-02T03:04:05.000Z');
    await fs.utimes(sourcePostPath, stableDate, stableDate);

    await migrateHexo({
      hexoRoot: pathToFileURL(`${hexoRoot}${path.sep}`),
      projectRoot: pathToFileURL(`${projectRoot}${path.sep}`).href,
    });
    const outputPostPath = path.join(outputBlogDir, 'sample-post.md');
    const firstOutput = await fs.readFile(outputPostPath, 'utf8');

    await migrateHexo({
      hexoRoot: pathToFileURL(`${hexoRoot}${path.sep}`),
      projectRoot: pathToFileURL(`${projectRoot}${path.sep}`).href,
    });
    const secondOutput = await fs.readFile(outputPostPath, 'utf8');
    const parsed = matter(secondOutput);

    await expect(fs.access(path.join(outputBlogDir, 'old-post.md'))).rejects.toThrow();
    await expect(fs.readFile(path.join(outputBlogDir, 'notes.txt'), 'utf8')).resolves.toBe('keep me');
    expect(parsed.data).toMatchObject({
      title: 'Sample Post',
      pubDate: stableDate,
      tags: ['Astro', 'Migration'],
      categories: ['Dev'],
      draft: false,
    });
    expect(parsed.content.trim()).toBe('Readable paragraph with **markdown**.');
    expect(firstOutput).toBe(secondOutput);
    await expect(
      fs.readFile(path.join(projectRoot, 'src', 'content', 'pages', 'about.md'), 'utf8'),
    ).resolves.toContain('title: About Me');
  });
});
