import { describe, expect, it } from 'vitest';

import {
  countTaxonomy,
  encodeHrefSegment,
  getPostNeighbors,
  getTableOfContentsItems,
  groupPostsByYearMonth,
} from '../src/lib/blog.ts';

const post = ({ pubDate, tags = [], categories = [], draft = false }) => ({
  data: {
    pubDate: new Date(pubDate),
    tags,
    categories,
    draft,
  },
});

describe('encodeHrefSegment', () => {
  it('encodes Chinese href path segments', () => {
    expect(encodeHrefSegment('开发日志')).toBe('%E5%BC%80%E5%8F%91%E6%97%A5%E5%BF%97');
  });
});

describe('countTaxonomy', () => {
  it('counts values and sorts by count descending then Chinese locale name ascending', () => {
    const posts = [
      post({ pubDate: '2024-01-01T00:00:00.000Z', tags: ['开发', '测试'] }),
      post({ pubDate: '2024-01-02T00:00:00.000Z', tags: ['算法', '开发'] }),
      post({ pubDate: '2024-01-03T00:00:00.000Z', tags: ['测试', '安卓'] }),
      post({ pubDate: '2024-01-04T00:00:00.000Z', tags: ['安卓'] }),
    ];

    expect(countTaxonomy(posts, 'tags')).toEqual([
      { name: '安卓', count: 2 },
      { name: '测试', count: 2 },
      { name: '开发', count: 2 },
      { name: '算法', count: 1 },
    ]);
  });
});

describe('groupPostsByYearMonth', () => {
  it('groups posts by year-month in descending month order', () => {
    const posts = [
      post({ pubDate: '2024-01-15T00:00:00.000Z' }),
      post({ pubDate: '2024-03-01T00:00:00.000Z' }),
      post({ pubDate: '2024-01-01T00:00:00.000Z' }),
      post({ pubDate: '2023-12-31T00:00:00.000Z' }),
    ];

    expect(groupPostsByYearMonth(posts)).toEqual([
      { key: '2024-03', year: '2024', month: '03', posts: [posts[1]] },
      { key: '2024-01', year: '2024', month: '01', posts: [posts[0], posts[2]] },
      { key: '2023-12', year: '2023', month: '12', posts: [posts[3]] },
    ]);
  });
});

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
