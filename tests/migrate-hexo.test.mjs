import { describe, expect, it } from 'vitest';

import {
  extractDescription,
  findRelativeImageReferences,
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
