import fs from 'fs';
import path from 'path';

/**
 * 受控状态 Badge 白名单
 */
export const ALLOWED_STATUS_BADGES = ['Merged', 'Released', 'Workaround', 'Issue', 'Testing'];

/**
 * 规范化状态 Badge，非法值自动降级映射为合法白名单项
 */
export function normalizeStatusBadge(status, changeType = '') {
	if (!status) return 'Merged';
	const trimmed = status.trim();
	const matched = ALLOWED_STATUS_BADGES.find(b => b.toLowerCase() === trimmed.toLowerCase());
	if (matched) return matched;

	// 降级映射字典
	const lower = trimmed.toLowerCase();
	if (lower.includes('release') || lower.includes('publish')) return 'Released';
	if (lower.includes('workaround') || lower.includes('fallback')) return 'Workaround';
	if (lower.includes('issue') || lower.includes('bug') || lower.includes('community')) return 'Issue';
	if (lower.includes('test') || lower.includes('benchmark')) return 'Testing';
	if (lower.includes('merge') || lower.includes('pr')) return 'Merged';

	if (changeType === 'issue_report') return 'Issue';
	if (changeType === 'driver_update') return 'Released';
	if (changeType === 'test_fix') return 'Testing';
	if (changeType === 'workaround') return 'Workaround';

	return 'Merged';
}

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
 * 复合条件匹配某个新闻动态是否命中了已知追踪线程
 * 必须满足 matchAll 中的全部关键词，且至少满足 matchAny 中的一个关键词
 */
export function matchNewsThreads(item, threads = []) {
	if (!threads || threads.length === 0) return [];
	const haystack = `${item.source || ''} ${item.title || ''} ${item.summary || ''} ${item.url || ''}`.toLowerCase();

	const matched = [];
	for (const thread of threads) {
		const matchAll = thread.matchAll || [];
		const matchAny = thread.matchAny || thread.keywords || [];

		const checkKeyword = (cleanKw) => {
			if (!cleanKw) return false;
			if (/^\d+$/.test(cleanKw)) {
				return haystack.includes(`/${cleanKw}`) || haystack.includes(`#${cleanKw}`) || haystack.includes(` ${cleanKw} `);
			}
			return haystack.includes(cleanKw);
		};

		// 必须满足全部 matchAll
		const allPassed = matchAll.length === 0 || matchAll.every(kw => checkKeyword(kw.trim().toLowerCase()));
		// 必须满足至少一个 matchAny
		const anyPassed = matchAny.length === 0 || matchAny.some(kw => checkKeyword(kw.trim().toLowerCase()));

		if (allPassed && anyPassed) {
			matched.push(thread);
		}
	}
	return matched;
}

/**
 * 评估单条新闻的技术重要性得分（v2.1：基础分归零，生产准入门槛提高，严打快照与水帖）
 */
export function scoreItemImportance(item, matchedThreads = []) {
	let score = 0; // 基础分归 0！
	const source = (item.source || '').toLowerCase();
	const title = (item.title || '').toLowerCase();
	const summary = (item.summary || '').toLowerCase();
	const url = (item.url || '').toLowerCase();
	const fullText = `${source} ${title} ${summary} ${url}`;

	// 1. 常规快照、每日构建、无变更 Release 严厉扣分 (-25 ~ -30)
	if (/(?:nightly|weekly|daily build|sycl-latest-good|latest-good|latest-buildable|snapshot)/i.test(fullText)) {
		score -= 25;
	}
	if (/(?:bump version|update readme|update changelog|license|typo|fix typo|format code|clang-format|pre-commit)/i.test(title)) {
		score -= 25;
	}
	if (/^(?:ci|chore|build|test|style|workflow)(?:\([^\)]+\))?:\s*/i.test(title)) {
		score -= 20;
	}
	if (/(?:github actions?|workflows?|ci runner|cache action|dependency update|dependabot|docker|sync branch|merge branch)/i.test(fullText)) {
		score -= 20;
	}

	// 2. Reddit 水帖、装机构想、日常配置求助扣分
	if (source.includes('reddit')) {
		if (/(?:steam machine|clone|setup|psu|power supply|should i buy|thoughts|fan noise|case build|help me)/i.test(fullText)) {
			score -= 20;
		} else {
			score -= 5;
		}
	}

	// 3. 旧 Issue 惩罚
	if (item.issueType === 'old') {
		score -= 15;
	}

	// 4. 核心架构、驱动发布与严重稳定性加分 (+15 ~ +20)
	// 真实显卡驱动正式发布（TechPowerUp 驱动发布、Game On、WHQL）
	if (source.includes('techpowerup') && /(?:driver|drivers|whql|game ready|beta release)/i.test(fullText)) {
		score += 20;
	}
	// Linux 图形栈重要进展 (Phoronix 核心内核/Mesa/Xe)
	if (source.includes('phoronix') && /(?:drm\/xe|mesa|anv|kernel|vram|fred|xe2|xe3)/i.test(fullText)) {
		score += 15;
	}
	// 关键致命错误与崩溃修复
	if (/(?:crash|freeze|hang|regression|black screen|bsod|segfault|corruption|deadlock|data loss|stutter)/i.test(fullText)) {
		score += 18;
	}
	// 上游主仓合入 (PyTorch, vLLM, SGLang, Triton)
	if (source.includes('上游合入') || source.includes('pytorch') || source.includes('vllm') || source.includes('sglang') || source.includes('triton')) {
		score += 15;
	}
	// 根因修复与临时绕过
	if (/(?:workaround|fallback|revert|root cause|hotfix|security advisory)/i.test(fullText)) {
		score += 14;
	}
	// 算子、核心加速、底层硬件特性
	if (/(?:triton|xpu|sycl|kernel|subgroup|xmx|esimd|usm|anv|kv cache|attention|quant|moe|fp8|int8)/i.test(fullText)) {
		score += 10;
	}
	// 真实 GitHub Release（排除快照）
	if (source.includes('release') && !/(?:nightly|snapshot|latest-good|latest-buildable)/i.test(fullText)) {
		score += 15;
	}

	// 5. 命中历史追踪线程高额加分 (+20)
	if (matchedThreads && matchedThreads.length > 0) {
		score += 20;
	}

	return score;
}

/**
 * 过滤并按技术重要性排序候选列表（v2.1：准入门槛提高至 15）
 */
export function filterAndRankItems(items, threads = [], minScore = 15, limit = 20) {
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

	// 限制输入条目数量，精选 Top-N
	return filtered.slice(0, limit);
}

/**
 * 构造请求 LLM 输出纯结构化 JSON 的 Prompts (v2.1)
 */
export function buildDailyPrompts(items, todayStr, history) {
	const promptData = items.map((it, idx) => {
		let threadInfo = '';
		if (it.matchedThreads && it.matchedThreads.length > 0) {
			const th = it.matchedThreads[0];
			const latestHistory = th.history?.[th.history.length - 1];
			threadInfo = `\n【关联追踪事件ID】: "${th.id}"
【追踪事件名】: "${th.title}"
【此前已知阶段】: [${latestHistory?.stage || th.status}] ${latestHistory?.note || ''} (最后跟进日期: ${th.lastUpdated})`;
		}

		return `[${idx + 1}] ID: item-${idx + 1}
来源: ${it.source} (重要度得分: ${it.score})
标题: ${it.title}
链接: ${it.url}
时间: ${it.updated}
摘要: ${it.summary ? it.summary.replace(/\s+/g, ' ') : '无摘要'}${threadInfo}
---`;
	}).join('\n');

	const yesterdayHighlightsPrompt = history?.yesterdayHighlights
		? `\n【往期（昨日）已报道核心速览 - 严禁重复！】\n以下是上一期日报已报道的关键内容，今天绝对禁止再次作为主要新闻重复报道：\n${history.yesterdayHighlights}\n`
		: '';

	const systemPrompt = `你是一名精通底层系统编程、GPU 架构与深度学习编译器的资深系统架构师。
你的任务：根据提供的过去 24 小时内经过清洗和重要性打分的信源列表，对今日 Intel GPU 技术生态进展进行技术提炼，并【必须输出纯 JSON 格式】。
${yesterdayHighlightsPrompt}
【输出格式要求 - 必须输出纯 JSON，禁止任何 Markdown 包装外壳】
输出必须是符合以下 JSON 结构的纯文本（不要带 \`\`\`json 标记）：
{
  "overview": [
    {
      "status": "Merged", // 仅限 "Merged" | "Released" | "Workaround" | "Issue" | "Testing"
      "title": "一句话概括核心主题",
      "summary": "一句话说明具体发生了什么与技术要点（控制在 40 字以内）"
    }
  ],
  "items": [
    {
      "section": "downstream", // 仅限 "downstream" | "upstream" | "drivers" | "community"
      "module": "模块名，例如: Triton XPU / vLLM XPU / Windows 驱动 / Linux drm/xe",
      "title": "改动标题",
      "sourceUrl": "对应的真实 URL",
      "sourceLabel": "简短链接文本，如 PR #1234 或 Phoronix",
      "changeType": "feature", // "feature" | "bugfix" | "workaround" | "test_fix" | "driver_update" | "issue_report"
      "isTrueFix": true, // 若仅为规避分支或测试跳过，必须为 false
      "claimOwner": "maintainer", // "maintainer" | "code" | "reporter" | "community"
      "rootCauseConfirmed": true, // 仅当维护者或代码确凿证实根因时为 true；报告者个人推测必须为 false
      "analysis": "核心技术分析与改动动机（客观严密，说明具体改动与根因）",
      "impact": "简短精炼评估对开发者编译、运行、性能或架构的具体影响；若属于规避或测试修复需明确点出",
      "threadId": null // 若命中了关联追踪事件，填入对应的 threadId 字符串，否则填 null
    }
  ]
}

【核心纪律与事实分层原则】
1. status 白名单：overview 中的 status 字段【严格只允许】从以下 5 个枚举中选择：
   - "Merged"（上游代码合入）
   - "Released"（正式驱动或框架发版）
   - "Workaround"（临时规避方案/降级回退）
   - "Issue"（问题追踪/Bug报告）
   - "Testing"（性能测试/基准/CI修复）
   严禁使用任何未经允许的值（例如绝对禁止使用 "Community"、"True upstream fix" 等）。

2. 事实与推断分离（claimOwner 与 rootCauseConfirmed）：
   - 如果某条 Issue 或 Bug 只是社区用户/报告者提交（claimOwner: "reporter"），且官方维护者尚未确认根因（rootCauseConfirmed: false），analysis 中【严禁】声称“根因确认为……”，必须使用“报告者推测可能与……有关”。
   - 区分 true fix 与 workaround：若是上层绕行或条件规避，isTrueFix 必须为 false，并在 impact 中明确指出是规避方案。

3. 宁缺毋滥：
   - overview 数量：提炼今日最核心的 1～3 条即可，没有高价值内容切勿硬凑；
   - 严禁公关套话（如“重磅”、“里程碑”、“颠覆性”、“赋予新生命”）；
   - 严禁机械句式（如“不是……而是……”）。`;

	const userPrompt = `以下是今日经过技术重要性打分筛选出的高价值信源列表，请严格按照上述 JSON Schema 提炼并输出纯 JSON：\n\n${promptData}`;

	return { systemPrompt, userPrompt };
}

/**
 * 解析 LLM 返回的 JSON 结构
 */
export function parseDailyJsonOutput(rawResponse) {
	if (!rawResponse || typeof rawResponse !== 'string') {
		throw new Error('LLM 返回内容为空');
	}

	let cleaned = rawResponse.trim();
	// 剔除可能的 ```json 或 ``` 标记
	cleaned = cleaned.replace(/^```(?:json)?\s*\r?\n/i, '');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');
	cleaned = cleaned.trim();

	// 定位首个 { 和最后一个 }
	const firstBrace = cleaned.indexOf('{');
	const lastBrace = cleaned.lastIndexOf('}');
	if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
		cleaned = cleaned.slice(firstBrace, lastBrace + 1);
	}

	try {
		return JSON.parse(cleaned);
	} catch (err) {
		throw new Error(`无法解析模型输出的 JSON: ${err.message}\n原始文本: ${rawResponse.slice(0, 300)}`);
	}
}

/**
 * 校验 JSON 数据完整性（发布前门禁）
 */
export function validateDailyJson(data) {
	const errors = [];
	const warnings = [];

	if (!data || typeof data !== 'object') {
		return { isValid: false, errors: ['数据不是合法的 JSON 对象'], warnings };
	}

	if (!Array.isArray(data.overview) || data.overview.length === 0) {
		errors.push('overview 必须为包含至少 1 条记录的数组');
	} else {
		data.overview.forEach((ov, idx) => {
			if (!ov.title || !ov.summary) {
				errors.push(`overview[${idx}] 缺少 title 或 summary`);
			}
			if (!ALLOWED_STATUS_BADGES.includes(ov.status)) {
				warnings.push(`overview[${idx}] 的 status "${ov.status}" 超出受控白名单，将被规范化`);
			}
		});
	}

	if (!Array.isArray(data.items) || data.items.length === 0) {
		errors.push('items 必须为包含至少 1 条记录的数组');
	} else {
		data.items.forEach((it, idx) => {
			if (!it.module || !it.title || !it.analysis || !it.impact) {
				errors.push(`items[${idx}] 缺少必要字段 (module/title/analysis/impact)`);
			}
		});
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * 程序渲染 Markdown（代码接管排版、Frontmatter、Badge 白名单与引用块）
 */
export function renderDailyMarkdown(jsonData, todayStr, threads = []) {
	const threadMap = new Map();
	if (Array.isArray(threads)) {
		threads.forEach(t => threadMap.set(t.id, t));
	}

	// 1. 生成受控 Frontmatter
	let md = `---
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

`;

	// 2. 生成核心速览（程序强制 Badge 白名单）
	md += `## 核心速览\n\n`;
	const overviewList = Array.isArray(jsonData.overview) ? jsonData.overview : [];
	for (const ov of overviewList) {
		const safeBadge = normalizeStatusBadge(ov.status);
		md += `- **\`[${safeBadge}]\`** **${ov.title.trim()}**：${ov.summary.trim()}\n`;
	}
	md += '\n';

	// 3. 板块映射与组织
	const SECTION_TITLES = {
		downstream: '## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)',
		upstream: '## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)',
		drivers: '## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)',
		community: '## 社区实测与生态动态',
	};

	const sectionOrder = ['downstream', 'upstream', 'drivers', 'community'];
	const items = Array.isArray(jsonData.items) ? jsonData.items : [];

	for (const secKey of sectionOrder) {
		const secItems = items.filter(it => it.section === secKey);
		if (secItems.length === 0) continue;

		md += `${SECTION_TITLES[secKey]}\n\n`;
		for (const it of secItems) {
			const mod = (it.module || 'Intel GPU').trim();
			const title = (it.title || '').trim();
			const analysis = (it.analysis || '').trim();
			const impact = (it.impact || '').trim();
			const sourceLabel = (it.sourceLabel || '来源链接').trim();
			const sourceUrl = (it.sourceUrl || '#').trim();

			// 条目第一行：模块名、改动主题、分析、链接
			md += `- **[${mod}] ${title}**：${analysis} [[${sourceLabel}](${sourceUrl})]\n`;

			// 条目第二行：影响评估行
			md += `  > **影响：** ${impact}\n`;

			// 条目第三行：如果命中了长线追踪事件，自动由代码追加续报行
			if (it.threadId && threadMap.has(it.threadId)) {
				const th = threadMap.get(it.threadId);
				const latestHistory = th.history?.[th.history.length - 1];
				const historyDate = latestHistory?.date || th.lastUpdated;
				const note = latestHistory?.note ? `（此前阶段：${latestHistory.note}）` : '';
				md += `  > 🔗 **续报（关联 ${historyDate} 日报）：** 事件跟踪【${th.title}】新进展${note}。\n`;
			}
		}
		md += '\n';
	}

	return md.trim();
}

/**
 * 清洗 Markdown 文本（向后兼容保留）
 */
export function sanitizeDailyMarkdown(text) {
	let cleaned = text.trim();
	cleaned = cleaned.replace(/^```(?:markdown)?\s*\r?\n/i, '');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');
	const firstYamlIndex = cleaned.indexOf('---');
	if (firstYamlIndex > 0) {
		cleaned = cleaned.slice(firstYamlIndex);
	}
	cleaned = cleaned.replace(/^(\s*---\s*\r?\n)+/, '---\n');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');
	return cleaned.trim();
}

/**
 * 校验生成的 Markdown 是否符合规范（发布前硬门禁）
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

	// 校验核心速览是否包含状态 Badge
	const overviewMatch = markdown.match(/## 核心速览([\s\S]*?)(?=##|$)/);
	if (overviewMatch) {
		const overviewText = overviewMatch[1];
		const hasBadges = /`\[(Merged|Released|Workaround|Issue|Testing)\]`/i.test(overviewText);
		if (!hasBadges) {
			errors.push('核心速览中未检测到合法的受控状态 Badge');
		}
	}

	// 校验正文条目是否包含 `> **影响：**`
	const hasImpactLines = />\s*\*\*影响[：:]\*\*/.test(markdown);
	if (!hasImpactLines) {
		errors.push('正文中未检测到 "> **影响：**" 结论行');
	}

	// 校验黑名单机械句式（硬错误）
	const forbiddenPhrases = ['不是……而是……', '不是...而是...', '重磅来袭', '赋予新生命', '颠覆性'];
	for (const phrase of forbiddenPhrases) {
		if (markdown.includes(phrase)) {
			errors.push(`检测到被禁用的机械公关套话: "${phrase}"`);
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		warnings,
	};
}
