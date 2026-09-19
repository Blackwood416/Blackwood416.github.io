import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
	matchNewsThreads,
	scoreItemImportance,
	filterAndRankItems,
	buildDailyPrompts,
	sanitizeDailyMarkdown,
	validateDailyMarkdown,
} from '../scripts/daily-lib.mjs';

const fixturePath = path.resolve('tests/fixtures/news-replay-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

describe('daily-lib v2 evaluation and replay tests', () => {
	it('correctly scores items and filters low-value CI/chore noise', () => {
		const { threads, sampleItems } = fixture;

		const noiseCi = sampleItems.find(i => i.id === 'item-noise-ci');
		const noiseTypo = sampleItems.find(i => i.id === 'item-noise-typo');
		const coreDriver = sampleItems.find(i => i.id === 'item-core-driver');
		const tritonPatch = sampleItems.find(i => i.id === 'item-triton-upstream');

		expect(scoreItemImportance(noiseCi)).toBeLessThanOrEqual(0);
		expect(scoreItemImportance(noiseTypo)).toBeLessThanOrEqual(0);
		expect(scoreItemImportance(coreDriver)).toBeGreaterThanOrEqual(25);
		expect(scoreItemImportance(tritonPatch)).toBeGreaterThanOrEqual(18);

		const ranked = filterAndRankItems(sampleItems, threads, 5);
		const rankedIds = ranked.map(i => i.id);

		expect(rankedIds).toContain('item-core-driver');
		expect(rankedIds).toContain('item-triton-upstream');
		expect(rankedIds).toContain('item-thread-match');
		expect(rankedIds).not.toContain('item-noise-ci');
		expect(rankedIds).not.toContain('item-noise-typo');
	});

	it('accurately matches continuous tracking threads', () => {
		const { threads, sampleItems } = fixture;
		const threadItem = sampleItems.find(i => i.id === 'item-thread-match');

		const matched = matchNewsThreads(threadItem, threads);
		expect(matched.length).toBeGreaterThanOrEqual(1);
		expect(matched[0].id).toBe('b580-cold-boot-screen-freeze');

		// 命中追踪线程后，得分应当显著提升
		const score = scoreItemImportance(threadItem, matched);
		expect(score).toBeGreaterThanOrEqual(35);
	});

	it('constructs prompt with fact stratification and thread context', () => {
		const { threads, sampleItems } = fixture;
		const ranked = filterAndRankItems(sampleItems, threads, 5);
		const { systemPrompt, userPrompt } = buildDailyPrompts(ranked, '2026-09-19', {
			yesterdayHighlights: '昨日速览要点',
		});

		// 验证提示词中包含对技术事实、修复性质判定、证据等级的强制规范
		expect(systemPrompt).toContain('【核心原则 1：技术事实准确性与层级区分（极度重要，严禁混淆）】');
		expect(systemPrompt).toContain('True upstream fix');
		expect(systemPrompt).toContain('Workaround/Fallback');
		expect(systemPrompt).toContain('Test Skip/Fix');
		expect(systemPrompt).toContain('分级措辞纪律');
		expect(systemPrompt).toContain('【关联追踪事件】');
		expect(userPrompt).toContain('b580-cold-boot-screen-freeze');
	});

	it('validates compliant daily report format according to v2 specification', () => {
		const validMarkdown = fixture.sampleGoodMarkdown;
		const validation = validateDailyMarkdown(validMarkdown);

		expect(validation.isValid).toBe(true);
		expect(validation.errors).toHaveLength(0);
		expect(validation.warnings).toHaveLength(0);
	});

	it('detects violations such as missing badges, missing impact lines, or forbidden phrases', () => {
		// 1. 缺少状态 Badge
		const badBadgeMarkdown = `---
title: "测试日报"
pubDate: "2026-09-19T08:30:00.000Z"
---
## 核心速览
- 没有Badge的核心速览条目
## 驱动、内核与图形栈
- **[驱动] 测试**：内容。
  > **影响：** 测试影响
`;
		const res1 = validateDailyMarkdown(badBadgeMarkdown);
		expect(res1.warnings.some(w => w.includes('状态 Badge'))).toBe(true);

		// 2. 缺少影响评估行
		const noImpactMarkdown = `---
title: "测试日报"
pubDate: "2026-09-19T08:30:00.000Z"
---
## 核心速览
- **\`[Merged]\`** 合入测试
## 驱动、内核与图形栈
- **[驱动] 测试**：纯内容，没有影响行。
`;
		const res2 = validateDailyMarkdown(noImpactMarkdown);
		expect(res2.warnings.some(w => w.includes('影响：'))).toBe(true);

		// 3. 包含禁用公关套话
		const forbiddenMarkdown = `---
title: "测试日报"
pubDate: "2026-09-19T08:30:00.000Z"
---
## 核心速览
- **\`[Merged]\`** 这不是普通的更新，而是重磅来袭的颠覆性升级。
## 驱动、内核与图形栈
- **[驱动] 测试**：内容。
  > **影响：** 测试影响
`;
		const res3 = validateDailyMarkdown(forbiddenMarkdown);
		expect(res3.warnings.some(w => w.includes('被禁用的机械公关套话'))).toBe(true);
	});

	it('cleans up raw code block wrappers and duplicate frontmatter lines', () => {
		const raw = `\`\`\`markdown
---
---
title: "Intel GPU 技术生态日报 (2026-09-19)"
pubDate: "2026-09-19T08:30:00.000Z"
---
## 核心速览
- **\`[Merged]\`** 测试
\`\`\``;

		const sanitized = sanitizeDailyMarkdown(raw);
		expect(sanitized.startsWith('---\ntitle:')).toBe(true);
		expect(sanitized.endsWith('测试')).toBe(true);
		expect(sanitized).not.toContain('```markdown');
		expect(sanitized).not.toContain('---\n---');
	});
});
