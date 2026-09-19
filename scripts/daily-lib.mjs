import fs from 'fs';
import path from 'path';

/**
 * 读取跨日跟踪线程库
 */
export function loadNewsThreads(threadsFilePath = 'src/data/news-threads.json') {
	const resolved = path.resolve(threadsFilePath);
	if (!fs.existsSync(resolved)) return [];
	try {
		const raw = fs.readFileSync(resolved, 'utf-8');
		return JSON.parse(raw);
	} catch (e) {
		console.warn('[daily-lib] 读取 news-threads.json 失败:', e.message);
		return [];
	}
}

/**
 * 匹配某个新闻动态是否命中了已知追踪线程
 */
export function matchNewsThreads(item, threads = []) {
	if (!threads || threads.length === 0) return [];
	const haystack = `${item.source || ''} ${item.title || ''} ${item.summary || ''} ${item.url || ''}`.toLowerCase();

	const matched = [];
	for (const thread of threads) {
		const keywords = thread.keywords || [];
		const isMatch = keywords.some(kw => {
			const cleanKw = kw.trim().toLowerCase();
			if (!cleanKw) return false;
			// 纯数字关键字（如 PR 编号 56250）进行整词或路径匹配
			if (/^\d+$/.test(cleanKw)) {
				return haystack.includes(`/${cleanKw}`) || haystack.includes(`#${cleanKw}`) || haystack.includes(` ${cleanKw} `);
			}
			return haystack.includes(cleanKw);
		});

		if (isMatch) {
			matched.push(thread);
		}
	}
	return matched;
}

/**
 * 评估单条新闻的技术重要性得分（分数越高越值得报道，负分项将被过滤）
 */
export function scoreItemImportance(item, matchedThreads = []) {
	let score = 10; // 基础分
	const source = (item.source || '').toLowerCase();
	const title = (item.title || '').toLowerCase();
	const summary = (item.summary || '').toLowerCase();
	const fullText = `${source} ${title} ${summary}`;

	// 1. 纯杂务/CI 减分与降噪（命中则极大概率过滤）
	if (/^(?:ci|chore|build|test|style|workflow)(?:\([^\)]+\))?:\s*/i.test(title)) {
		score -= 15;
	}
	if (/(?:bump version|update readme|update changelog|license|typo|fix typo|format code|clang-format|pre-commit)/i.test(title)) {
		score -= 20;
	}
	if (/(?:github actions?|workflows?|ci runner|cache action|dependency update|dependabot)/i.test(fullText)) {
		score -= 15;
	}

	// 2. 核心架构、驱动与严重稳定性加分
	if (source.includes('release') || source.includes('techpowerup') || source.includes('phoronix')) {
		score += 15;
	}
	if (source.includes('上游合入') || source.includes('pytorch') || source.includes('vllm') || source.includes('sglang')) {
		score += 12;
	}
	if (/(?:crash|freeze|hang|regression|black screen|bsod|segfault|corruption|deadlock|data loss)/i.test(fullText)) {
		score += 15;
	}
	if (/(?:workaround|fallback|revert|root cause|hotfix|security advisory)/i.test(fullText)) {
		score += 12;
	}
	if (/(?:triton|xpu|sycl|kernel|subgroup|xmx|esimd|usm|drm\/xe|mesa|anv|kv cache|attention|quant)/i.test(fullText)) {
		score += 8;
	}

	// 3. 命中历史追踪线程加分（延续性报道具备高度技术价值）
	if (matchedThreads && matchedThreads.length > 0) {
		score += 20;
	}

	return score;
}

/**
 * 过滤并按技术重要性排序候选列表
 */
export function filterAndRankItems(items, threads = [], minScore = 5, limit = 35) {
	const scored = items.map(item => {
		const matchedThreads = matchNewsThreads(item, threads);
		const score = scoreItemImportance(item, matchedThreads);
		return {
			...item,
			matchedThreads,
			score,
		};
	});

	// 过滤低分噪音项
	const filtered = scored.filter(item => item.score >= minScore);

	// 按重要性从高到低排序
	filtered.sort((a, b) => b.score - a.score);

	// 限制输入 LLM 的最大条目数量，防止 token 溢出或信息稀释
	return filtered.slice(0, limit);
}

/**
 * 构造注入了技术分层纪律、线程追踪与措辞规范的 Prompt
 */
export function buildDailyPrompts(items, todayStr, history) {
	const promptData = items.map((it, idx) => {
		let threadInfo = '';
		if (it.matchedThreads && it.matchedThreads.length > 0) {
			const th = it.matchedThreads[0];
			const latestHistory = th.history?.[th.history.length - 1];
			threadInfo = `\n【关联追踪事件】: ${th.title} (ID: ${th.id})
【此前阶段】: [${latestHistory?.stage || th.status}] ${latestHistory?.note || ''} (最后跟进日期: ${th.lastUpdated})`;
		}

		return `[${idx + 1}] 来源: ${it.source} (重要度得分: ${it.score})
标题: ${it.title}
链接: ${it.url}
时间: ${it.updated}
摘要: ${it.summary ? it.summary.replace(/\s+/g, ' ') : '无摘要'}${threadInfo}
---`;
	}).join('\n');

	const yesterdayHighlightsPrompt = history?.yesterdayHighlights
		? `\n【往期（昨日）已报道核心速览 - 严禁重复！】\n以下是上一期日报已报道的关键内容，今天绝对禁止再次作为主要新闻重复报道：\n${history.yesterdayHighlights}\n`
		: '';

	const systemPrompt = `你是一名精通底层系统编程、GPU 架构与深度学习编译器的资深系统架构师，深度关注 Intel GPU（Arc 独显如 Battlemage/Alchemist、核显如 Lunar Lake/Arrow Lake、数据中心 GPU）及其 AI 软件栈（oneAPI、SYCL、XPU、Triton、oneDNN、oneMKL、OpenVINO GenAI、vLLM、SGLang、ComfyUI、llama.cpp、Ollama、Windows 驱动、Linux drm/xe 驱动）。

你的任务：根据提供的过去 24 小时内经过清洗和重要性打分的信源列表，撰写一篇专业、严谨、有深度、低“AI味”的《Intel GPU 技术生态日报》。
${yesterdayHighlightsPrompt}
【核心原则 1：技术事实准确性与层级区分（极度重要，严禁混淆）】
在分析每个 PR、Commit 或 Issue 时，模型必须在技术原理层面严格区分：
1. PR / commit 具体做了什么（代码层面的改动）；
2. 根因（Root Cause）到底在哪里；
3. 修复性质判定（严禁偷换概念）：
   - 【True upstream fix】底层/内核的真正根因修复；
   - 【Workaround/Fallback】上层临时规避分支、降级路径或绕行方案（绝对不能写成“底层已修复”）；
   - 【Test Skip/Fix】仅仅是调整了测试断言、跳过 CI 测试或修复了测试用例本身的缺陷（不能写成功能或内核已修复）；
4. 当前状态（Merged / Released / Testing / Workaround / Issue）。

【核心原则 2：证据与推断严格分离（分级措辞纪律）】
- 【事实/确认】：代码、Commit 说明或官方 Release 文档有明确事实证实的，使用“已合入”、“代码确认”、“已修复”、“新增”；
- 【推断/分析】：基于代码逻辑的合理技术推断，使用“表明”、“看起来”、“推测可能与……有关”；
- 【研判/观点】：资深编辑技术研判，使用“值得关注”、“建议持续跟进”；
- 严禁在无证据支持时臆测因果或扩大结论。

【核心原则 3：反套话与反炒冷饭红线】
1. 严禁炒冷饭：只报道今天新发生的代码改动、新 PR 或新基准。往期已报道的内容绝不重复作为重点；
2. 宁缺毋滥：若某个板块今天没有产生高价值更新，请直接省略该板块标题，严禁无中生有；
3. 严禁使用“不是……而是……”、“不仅如此……”、“总的来说……”、“正如大家所知……”等机械套话；
4. 严禁任何公关宣传词汇（如“重磅来袭”、“里程碑”、“颠覆性”、“赋能”等）。保留硬核术语（如 ESIMD, Subgroup, XMX, Level Zero, SYCL, USM, DP, MTP, KV Cache, drm/xe, ANV）。

【排版与条目格式规范】
1. 核心速览：
   每条必须携带状态 Badge，格式为：
   - **\`[状态Badge]\`** **[简明主题]**：一句话要点概括。
   可用 Badge 包括：\`[Merged]\`, \`[Released]\`, \`[Workaround]\`, \`[Issue]\`, \`[Testing]\`。

2. 正文条目格式：
   - **[组件/模块] 改动主题**：核心技术分析、改动动机及根因。[[PR/Release 简写](链接)]
     > **影响：** （简短精炼评估对开发者编译、运行、性能或架构影响；明确指出是真修复、临时规避还是测试调整）
   - 若信源中带有【关联追踪事件】，必须紧接着追加一行：
     > 🔗 **续报（关联 YYYY-MM-DD 日报）：** （阐述该问题从之前的阶段演进至今日新阶段的过程）

【输出结构】
必须直接输出完整的 Markdown 文件内容，包含合规的 YAML Frontmatter：
---
title: "Intel GPU 技术生态日报 (${todayStr})"
description: "今日 Intel GPU 动态速览：包含驱动内核演进、算子与推理引擎适配进展。"
pubDate: "${todayStr}T08:30:00.000Z"
tags:
  - Intel
  - GPU
  - Arc
  - oneAPI
  - XPU
  - 日报
categories:
  - 技术日报
  - 显卡
draft: false
---

正文使用二级标题组织（无更新的板块直接省略）：
## 核心速览

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)

## 社区实测与生态动态`;

	const userPrompt = `以下是今日经过技术重要性打分筛选出的高价值信源列表，请严格按照上述技术事实分层、证据分级、状态 Badge 以及影响评估行的要求提炼并生成完整 Markdown：\n\n${promptData}`;

	return { systemPrompt, userPrompt };
}

/**
 * 清洗生成的 Markdown 文本
 */
export function sanitizeDailyMarkdown(text) {
	let cleaned = text.trim();
	// 剔除可能存在的最外层 ```markdown 或 ``` 标记
	cleaned = cleaned.replace(/^```(?:markdown)?\s*\r?\n/i, '');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');

	// 处理嵌套异常包装，如 "---\n```markdown\n---"
	cleaned = cleaned.replace(/^---\s*\r?\n```(?:markdown)?\s*\r?\n---/i, '---');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');

	// 确保定位到首个 --- Frontmatter 起始
	const firstYamlIndex = cleaned.indexOf('---');
	if (firstYamlIndex > 0) {
		cleaned = cleaned.slice(firstYamlIndex);
	}

	// 核心安全强化：如果开头连续出现多个 --- 分隔符，仅保留单个 ---
	cleaned = cleaned.replace(/^(\s*---\s*\r?\n)+/, '---\n');

	// 剔除尾部可能残留的代码块闭合标记
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');

	return cleaned.trim();
}

/**
 * 校验生成的 Markdown 是否符合 v2 规范
 */
export function validateDailyMarkdown(markdown) {
	const errors = [];
	const warnings = [];

	if (!markdown.startsWith('---') || !markdown.includes('title:') || !markdown.includes('pubDate:')) {
		errors.push('缺少标准 YAML Frontmatter (title/pubDate)');
	}

	if (!markdown.includes('## 核心速览')) {
		errors.push('缺少 "## 核心速览" 二级标题');
	}

	// 校验核心速览是否包含状态 Badge（如 `[Merged]`、`[Released]` 等）
	const overviewMatch = markdown.match(/## 核心速览([\s\S]*?)(?=##|$)/);
	if (overviewMatch) {
		const overviewText = overviewMatch[1];
		const hasBadges = /`\[(Merged|Released|Workaround|Issue|Testing|RFC)\]`/i.test(overviewText);
		if (!hasBadges) {
			warnings.push('核心速览中未检测到状态 Badge (如 `[Merged]`)');
		}
	}

	// 校验正文条目是否包含 `> **影响：**`
	const hasImpactLines = />\s*\*\*影响[：:]\*\*/.test(markdown);
	if (!hasImpactLines) {
		warnings.push('正文中未检测到 "> **影响：**" 结论行');
	}

	// 校验黑名单机械句式
	const forbiddenPhrases = ['不是……而是……', '不是...而是...', '重磅来袭', '赋予新生命'];
	for (const phrase of forbiddenPhrases) {
		if (markdown.includes(phrase)) {
			warnings.push(`检测到被禁用的机械公关套话: "${phrase}"`);
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}
