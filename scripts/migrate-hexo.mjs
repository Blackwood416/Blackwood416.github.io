import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import { pathToFileURL } from 'url';
import matter from 'gray-matter';

export const DEFAULT_HEXO_ROOT = 'F:/hexo-blogs';

const BLOG_OUTPUT_DIR = path.join('src', 'content', 'blog');
const ABOUT_OUTPUT_PATH = path.join('src', 'content', 'pages', 'about.md');

export function normalizeList(value) {
  if (value == null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  const trimmed = String(value).trim();
  return trimmed ? [trimmed] : [];
}

export function removeDuplicateTitleHeading(markdown, title) {
  const normalizedTitle = String(title ?? '').trim();
  if (!normalizedTitle) {
    return markdown;
  }

  const match = markdown.match(/^\s*#\s+(.+?)\s*(?:\r?\n|$)/);
  if (!match || match[1].trim() !== normalizedTitle) {
    return markdown;
  }

  return markdown.slice(match[0].length).replace(/^\s*(?:\r?\n)+/, '');
}

export function extractDescription(markdown) {
  const paragraphs = markdown.split(/\r?\n\s*\r?\n/);

  for (const paragraph of paragraphs) {
    const text = paragraph.trim();
    if (!text || /^#{1,6}\s+/u.test(text) || isImageOnlyParagraph(text)) {
      continue;
    }

    const description = stripMarkdownInlineSyntax(text).replace(/\s+/g, ' ').trim();
    if (description) {
      return description;
    }
  }

  return '';
}

export function findRelativeImageReferences(markdown) {
  const references = [];
  const imagePattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

  for (const match of markdown.matchAll(imagePattern)) {
    const src = match[2].trim();
    if (isRelativeImageSource(src)) {
      references.push({ alt: match[1], src });
    }
  }

  return references;
}

export async function migrateHexo({
  hexoRoot = DEFAULT_HEXO_ROOT,
  projectRoot = process.cwd(),
} = {}) {
  const sourcePostsDir = path.join(hexoRoot, 'source', '_posts');
  const sourceAboutPath = path.join(hexoRoot, 'source', 'about', 'index.md');
  const outputBlogDir = path.join(projectRoot, BLOG_OUTPUT_DIR);
  const outputAboutPath = path.join(projectRoot, ABOUT_OUTPUT_PATH);

  await fs.mkdir(outputBlogDir, { recursive: true });
  await fs.mkdir(path.dirname(outputAboutPath), { recursive: true });
  await emptyMarkdownFiles(outputBlogDir);

  const migratedPosts = [];
  const relativeImageFindings = [];
  const sourcePostEntries = await fs.readdir(sourcePostsDir, { withFileTypes: true });

  for (const entry of sourcePostEntries) {
    if (!entry.isFile() || !isMarkdownFilename(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourcePostsDir, entry.name);
    const parsed = matter(await fs.readFile(sourcePath, 'utf8'));
    if (!isPublishedPost(parsed.data)) {
      continue;
    }

    const title = String(parsed.data.title ?? path.parse(entry.name).name);
    const content = removeDuplicateTitleHeading(parsed.content, title);
    const frontmatter = {
      title,
      description: String(parsed.data.description ?? parsed.data.excerpt ?? extractDescription(content)),
      pubDate: normalizeDate(parsed.data.date ?? parsed.data.pubDate ?? parsed.data.published),
      tags: normalizeList(parsed.data.tags),
      categories: normalizeList(parsed.data.categories),
      draft: false,
    };

    const outputPath = path.join(outputBlogDir, entry.name);
    await fs.writeFile(outputPath, matter.stringify(content.trimStart(), frontmatter), 'utf8');
    migratedPosts.push({ sourcePath, outputPath });

    for (const reference of findRelativeImageReferences(content)) {
      const resolvedPath = path.resolve(path.dirname(sourcePath), reference.src);
      relativeImageFindings.push({
        post: entry.name,
        src: reference.src,
        path: resolvedPath,
        exists: await fileExists(resolvedPath),
      });
    }
  }

  const about = matter(await fs.readFile(sourceAboutPath, 'utf8'));
  const aboutTitle = String(about.data.title ?? 'About');
  const aboutContent = removeDuplicateTitleHeading(about.content, aboutTitle);
  await fs.writeFile(outputAboutPath, matter.stringify(aboutContent.trimStart(), { title: aboutTitle }), 'utf8');

  return {
    migratedPostCount: migratedPosts.length,
    migratedPosts,
    aboutOutputPath: outputAboutPath,
    relativeImageFindings,
  };
}

function stripMarkdownInlineSyntax(markdown) {
  return markdown
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`]+/g, '')
    .replace(/<[^>]+>/g, '');
}

function isImageOnlyParagraph(paragraph) {
  return /^!\[[^\]]*\]\([^)]+\)\s*$/u.test(paragraph);
}

function isRelativeImageSource(src) {
  return !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/iu.test(src);
}

function isMarkdownFilename(filename) {
  return /\.(?:md|mdx)$/iu.test(filename);
}

function isPublishedPost(data) {
  return data.draft !== true && data.published !== false;
}

function normalizeDate(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value == null || String(value).trim() === '') {
    return new Date().toISOString();
  }

  return String(value);
}

async function emptyMarkdownFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await emptyMarkdownFiles(entryPath);
        return;
      }

      if (entry.isFile() && isMarkdownFilename(entry.name)) {
        await fs.unlink(entryPath);
      }
    }),
  );
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isCliExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

function printSummary(result) {
  console.log(`Migrated posts: ${result.migratedPostCount}`);
  console.log(`About output: ${result.aboutOutputPath}`);

  if (result.relativeImageFindings.length === 0) {
    console.log('Relative image findings: none');
    return;
  }

  console.log('Relative image findings:');
  for (const finding of result.relativeImageFindings) {
    const status = finding.exists ? 'exists' : 'missing';
    console.log(`- ${finding.post}: ${finding.src} (${status})`);
  }
}

if (isCliExecution()) {
  migrateHexo()
    .then(printSummary)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
