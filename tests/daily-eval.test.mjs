import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
	matchNewsThreads,
	scoreItemImportance,
	filterAndRankItems,
	buildDailyPrompts,
	parseDailyJsonOutput,
	validateDailyJson,
	renderDailyMarkdown,
	normalizeStatusBadge,
	ALLOWED_STATUS_BADGES,
	sanitizeDailyMarkdown,
	validateDailyMarkdown,
} from '../scripts/daily-lib.mjs';

const fixturePath = path.resolve('tests/fixtures/news-replay-sample.json');
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));

describe('daily-lib v2.1 evaluation and replay tests', () => {
	it('correctly scores items and aggressively filters nightly snapshots and reddit noise (v2.1)', () => {
		const { threads, sampleItems } = fixture;

		const noiseNightly = sampleItems.find(i => i.id === 'item-noise-nightly');
		const noiseReddit = sampleItems.find(i => i.id === 'item-noise-reddit-steam-machine');
		const noiseCi = sampleItems.find(i => i.id === 'item-noise-ci');
		const coreDriver = sampleItems.find(i => i.id === 'item-core-driver');

		// 常规快照与水帖基础分归零后被扣为负分
		expect(scoreItemImportance(noiseNightly)).toBeLessThanOrEqual(0);
		expect(scoreItemImportance(noiseReddit)).toBeLessThanOrEqual(0);
		expect(scoreItemImportance(noiseCi)).toBeLessThanOrEqual(0);
		expect(scoreItemImportance(coreDriver)).toBeGreaterThanOrEqual(20);

		// 提高到 15 分准入门槛
		const ranked = filterAndRankItems(sampleItems, threads, 15);
		const rankedIds = ranked.map(i => i.id);

		expect(rankedIds).toContain('item-core-driver');
		expect(rankedIds).toContain('item-thread-match');
		expect(rankedIds).not.toContain('item-noise-nightly');
		expect(rankedIds).not.toContain('item-noise-reddit-steam-machine');
		expect(rankedIds).not.toContain('item-noise-ci');
	});

	it('eliminates single-keyword false positives via compound thread matching (v2.1)', () => {
		const { threads, sampleItems } = fixture;
		const threadItem = sampleItems.find(i => i.id === 'item-thread-match');
		const unrelatedB580 = sampleItems.find(i => i.id === 'item-b580-unrelated');

		// 命中 B580 且包含黑屏/冻结特征
		const matchedPositive = matchNewsThreads(threadItem, threads);
		expect(matchedPositive.length).toBe(1);
		expect(matchedPositive[0].id).toBe('b580-cold-boot-screen-freeze');

		// 仅出现 B580 关键词，但属于光追基准实测，无冷启动/冻结特征 -> 绝不误匹配！
		const matchedNegative = matchNewsThreads(unrelatedB580, threads);
		expect(matchedNegative).toHaveLength(0);
	});

	it('normalizes arbitrary LLM status badges into strict whitelist (v2.1)', () => {
		expect(ALLOWED_STATUS_BADGES).toEqual(['Merged', 'Released', 'Workaround', 'Issue', 'Testing']);

		// 合法白名单直接保留
		expect(normalizeStatusBadge('Merged')).toBe('Merged');
		expect(normalizeStatusBadge('Released')).toBe('Released');
		expect(normalizeStatusBadge('Issue')).toBe('Issue');

		// 非法 LLM 自造词被程序强行规范化
		expect(normalizeStatusBadge('Community')).toBe('Issue');
		expect(normalizeStatusBadge('True upstream fix')).toBe('Merged');
		expect(normalizeStatusBadge('benchmark test')).toBe('Testing');
		expect(normalizeStatusBadge('fallback patch')).toBe('Workaround');
	});

	it('robustly parses and validates structured JSON output from LLM (v2.1)', () => {
		const rawWithCodeBlock = `\`\`\`json
{
  "overview": [
    { "status": "Merged", "title": "Triton XPU 补丁", "summary": "修复布局转换" }
  ],
  "items": [
    {
      "section": "downstream",
      "module": "Triton XPU",
      "title": "布局锚定修复",
      "sourceUrl": "https://github.com/...",
      "sourceLabel": "PR #8112",
      "changeType": "bugfix",
      "isTrueFix": true,
      "claimOwner": "maintainer",
      "rootCauseConfirmed": true,
      "analysis": "修复 pass 中的错误标记",
      "impact": "保证计算正确性",
      "threadId": null
    }
  ]
}
\`\`\``;

		const parsed = parseDailyJsonOutput(rawWithCodeBlock);
		expect(parsed.overview).toHaveLength(1);
		expect(parsed.items).toHaveLength(1);

		const validation = validateDailyJson(parsed);
		expect(validation.isValid).toBe(true);
	});

	it('programmatically renders Markdown with strict Frontmatter, badges and thread continuation (v2.1)', () => {
		const { threads, sampleJsonOutput } = fixture;
		const rendered = renderDailyMarkdown(sampleJsonOutput, '2026-09-19', threads);

		// 验证 Frontmatter
		expect(rendered).toContain('title: "Intel GPU 技术生态日报 (2026-09-19)"');
		expect(rendered).toContain('tags:');

		// 验证核心速览与受控 Badge
		expect(rendered).toContain("## 核心速览\n\n- **`[Released]`** **Intel Arc 驱动 101.9030 Beta 发布**：新增多款新游优化，修复 Core Ultra DX12 卡顿\n- **`[Issue]`** **B580 冷启动与黑屏冻结追踪**：社区反馈 4K 60Hz 唤醒异常，官方固件排查中");

		// 验证板块与正文条目排版
		expect(rendered).toContain('## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)');
		expect(rendered).toContain('- **[Windows 驱动] Arc 101.9030 Beta 发布**：修复 Dragon\'s Dogma 2 DX12 在 Core Ultra 平台的性能卡顿。 [[TechPowerUp](https://www.techpowerup.com/352834/intel-arc-gpu-graphics-drivers-101-9030-beta-released)]');
		expect(rendered).toContain('> **影响：** 该更新为针对上层特定游戏的驱动热修复，推荐遇到卡顿的用户升级。');

		// 验证程序自动注入的续报行
		expect(rendered).toContain('> 🔗 **续报（关联 2026-09-19 日报）：** 事件跟踪【Arc B580 锁屏唤醒与冷启动冻结问题】新进展（此前阶段：社区多位用户报告 B580 冷启动失败与 4K 60Hz 限制，IGCIT #1560 持续跟进）。');
	});

	it('acts as a pre-flight gate that blocks illegal output before writing to disk (v2.1)', () => {
		// 缺少合法 Badge
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
		expect(res1.isValid).toBe(false);
		expect(res1.errors.some(e => e.includes('受控状态 Badge'))).toBe(true);

		// 包含禁用公关套话 -> 拦截
		const forbiddenMarkdown = `---
title: "测试日报"
pubDate: "2026-09-19T08:30:00.000Z"
---
## 核心速览
- **\`[Merged]\`** 这不是普通的更新，而是重磅来袭的升级。
## 驱动、内核与图形栈
- **[驱动] 测试**：内容。
  > **影响：** 测试影响
`;
		const res2 = validateDailyMarkdown(forbiddenMarkdown);
		expect(res2.isValid).toBe(false);
		expect(res2.errors.some(e => e.includes('被禁用的机械公关套话'))).toBe(true);
	});
});
