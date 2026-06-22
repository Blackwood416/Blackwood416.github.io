import { describe, expect, it } from 'vitest';

import { countTaxonomy, encodeHrefSegment, groupPostsByYearMonth } from '../src/lib/blog.ts';

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
