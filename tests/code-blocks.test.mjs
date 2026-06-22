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
