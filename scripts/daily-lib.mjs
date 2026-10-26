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
	const trimmed = String(status).trim();
	const matched = ALLOWED_STATUS_BADGES.find(b => b.toLowerCase() === trimmed.toLowerCase());
	if (matched) return matched;

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
 * 渲染状态胶囊（HTML 内联，样式见 global.css .news-badge）
 */
export function renderBadge(status) {
	const safe = normalizeStatusBadge(status);
	return `<span class="news-badge news-badge--${safe.toLowerCase()}">${safe}</span>`;
}

/**
 * 与 github-slugger（Astro 标题锚点）一致的简化 slug 实现
 */
export function slugifyHeading(text) {
	return String(text)
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, '')
		.replace(/\s/g, '-');
}

// ---------------------------------------------------------------------------
// 来源 → 板块 / 模块（由代码决定，LLM 不参与）
// ---------------------------------------------------------------------------

export const SECTION_ORDER = ['upstream', 'downstream', 'drivers', 'community'];

export const SECTION_TITLES = {
	upstream: '主流框架与上游集成',
	downstream: '编译器与加速库',
	drivers: '驱动、内核与图形栈',
	community: '社区反馈',
};

const MODULE_RULES = [
	// [匹配 source 的正则, 板块, 模块名]
	[/上游合入:\s*vllm/i, 'upstream', 'vLLM XPU'],
	[/上游合入:\s*sglang/i, 'upstream', 'SGLang XPU'],
	[/上游合入:\s*pytorch/i, 'upstream', 'PyTorch XPU'],
	[/上游合入:\s*llama\.cpp/i, 'upstream', 'llama.cpp SYCL'],
	[/上游合入:\s*comfyui/i, 'upstream', 'ComfyUI'],
	[/上游合入:\s*ollama/i, 'upstream', 'Ollama'],
	[/上游合入:\s*deepspeed/i, 'upstream', 'DeepSpeed'],
	[/上游合入/i, 'upstream', '其他框架'],
	[/intel-xpu-backend-for-triton/i, 'downstream', 'Triton XPU 后端'],
	[/llm-scaler/i, 'downstream', 'intel/llm-scaler'],
	[/openvino/i, 'downstream', 'OpenVINO'],
	[/onednn/i, 'downstream', 'oneDNN'],
	[/onemkl/i, 'downstream', 'oneMKL'],
	[/intel\/llvm/i, 'downstream', 'SYCL 编译器'],
	[/compute-runtime/i, 'drivers', 'compute-runtime'],
	[/intel-graphics-compiler/i, 'drivers', 'IGC 图形编译器'],
	[/level-zero/i, 'drivers', 'Level Zero'],
	[/techpowerup/i, 'drivers', 'Windows 驱动'],
	[/phoronix/i, 'drivers', 'Linux 图形栈'],
	[/igcit|社区驱动追踪/i, 'community', 'IGCIT 问题追踪'],
	[/reddit/i, 'community', 'Reddit r/IntelArc'],
];

export function classifySource(source = '') {
	for (const [re, section, module] of MODULE_RULES) {
		if (re.test(source)) return { section, module };
	}
	return { section: 'community', module: '其他' };
}

/**
 * 由 URL 生成链接文本（不信任 LLM 给出的链接）
 */
export function deriveLinkLabel(url = '', source = '') {
	let m;
	if ((m = url.match(/\/pull\/(\d+)/))) return `PR #${m[1]}`;
	if ((m = url.match(/\/issues\/(\d+)/))) return `#${m[1]}`;
	if ((m = url.match(/\/commit\/([a-f0-9]{7})/i))) return `commit ${m[1]}`;
	if ((m = url.match(/\/releases\/tag\/([^/?#]+)/))) return decodeURIComponent(m[1]);
	if (/phoronix/i.test(url)) return 'Phoronix';
	if (/techpowerup/i.test(url)) return 'TechPowerUp';
	if (/reddit/i.test(url)) return 'Reddit';
	return source.split(/[\s(]/)[0] || '来源';
}

// ---------------------------------------------------------------------------
// 次要条目判定 & 空洞影响行过滤
// ---------------------------------------------------------------------------

const MINOR_CHANGE_TYPES = new Set(['test_fix', 'ci', 'sync', 'build', 'chore', 'docs']);
const MINOR_TITLE_RE = /(\bci\b|\btests?\b|\bskip\b|timeout|flaky|retry|\bwarning\b|\blint\b|\btypo\b|\bbump\b|测试|跳过|超时|去抖|告警|误报|同步上游|适配上游|上游同步|CI)/i;

export function isMinorItem(item) {
	if (item.tier === 'minor') return true;
	if (MINOR_CHANGE_TYPES.has(item.changeType)) return true;
	return MINOR_TITLE_RE.test(item.title || '');
}

const HOLLOW_IMPACT_PATTERNS = [
	/可能包含.{0,12}(改进|修复)/,
	/^(提高|提升|增强|改善).{0,10}(正确性|稳定性|兼容性|可靠性|准确性)[。.]?$/,
	/简化\s*CI/,
	/保持与上游(同步|一致)/,
	/提升测试覆盖/,
	/确保测试(正确|正常|通过)/,
	/普通用户感知有限/,
	/需测试性能影响/,
];

export function isHollowImpact(text) {
	if (!text || typeof text !== 'string') return true;
	const t = text.trim();
	if (t.length < 12) return true;
	return HOLLOW_IMPACT_PATTERNS.some(re => re.test(t));
}

// ---------------------------------------------------------------------------
// 线程库与匹配
// ---------------------------------------------------------------------------

export function loadNewsThreads(threadsFilePath = 'src/data/news-threads.json') {
	const resolved = path.resolve(threadsFilePath);
	if (!fs.existsSync(resolved)) return [];
	try {
		return JSON.parse(fs.readFileSync(resolved, 'utf-8'));
	} catch (e) {
		console.warn('[daily-lib] 读取 news-threads.json 失败:', e.message);
		return [];
	}
}

/**
 * 复合条件匹配：必须满足 matchAll 全部，且命中 matchAny 至少一个
 */
export function matchNewsThreads(item, threads = []) {
	if (!threads || threads.length === 0) return [];
	const haystack = `${item.source || ''} ${item.title || ''} ${item.summary || ''} ${item.url || ''}`.toLowerCase();

	const checkKeyword = (kw) => {
		const cleanKw = kw.trim().toLowerCase();
		if (!cleanKw) return false;
		if (/^\d+$/.test(cleanKw)) {
			return haystack.includes(`/${cleanKw}`) || haystack.includes(`#${cleanKw}`) || haystack.includes(` ${cleanKw} `);
		}
		return haystack.includes(cleanKw);
	};

	return threads.filter(thread => {
		const matchAll = thread.matchAll || [];
		const matchAny = thread.matchAny || thread.keywords || [];
		const allPassed = matchAll.length === 0 || matchAll.every(checkKeyword);
		const anyPassed = matchAny.length === 0 || matchAny.some(checkKeyword);
		return allPassed && anyPassed;
	});
}

// ---------------------------------------------------------------------------
// 相关性与重要性
// ---------------------------------------------------------------------------

const GPU_SPECIFIC_RE = /\b(xe[23]?|xe-?kmd|i915|anv|iris|battlemage|alchemist|celestial|lunar lake|panther lake|arrow lake|meteor lake|arc (a|b)\d{3}|arc pro|intel arc|arc graphics|oneapi|level zero|openvino|sycl)\b/i;
const GPU_CONTEXT_RE = /\b(graphics|gpu|igpu|dgpu|mesa|drm|vulkan|opengl|driver|compute)\b/i;

/**
 * 判断一条新闻是否真的与 Intel GPU 相关（整词匹配，避免 search/architecture 误命中 arc）
 */
export function isIntelGpuRelated(text = '') {
	if (GPU_SPECIFIC_RE.test(text)) return true;
	return /\bintel\b/i.test(text) && GPU_CONTEXT_RE.test(text);
}

export function scoreItemImportance(item, matchedThreads = []) {
	let score = 0;
	const source = (item.source || '').toLowerCase();
	const title = (item.title || '').toLowerCase();
	const summary = (item.summary || '').toLowerCase();
	const url = (item.url || '').toLowerCase();
	const fullText = `${source} ${title} ${summary} ${url}`;

	// 常规快照与杂务
	if (/(?:nightly|weekly|daily build|sycl-latest-good|latest-good|latest-buildable|snapshot)/i.test(fullText)) score -= 25;
	if (/(?:bump version|update readme|update changelog|license|typo|fix typo|format code|clang-format|pre-commit)/i.test(title)) score -= 25;
	if (/^(?:\[(?:ci|test|tests)\]|(?:ci|chore|build|test|style|workflow)(?:\([^\)]+\))?:)\s*/i.test(title)) score -= 20;
	if (/(?:github actions?|workflows?|ci runner|cache action|dependency update|dependabot|docker|sync branch|merge branch)/i.test(fullText)) score -= 20;

	// Reddit
	if (source.includes('reddit')) {
		if (/(?:steam machine|clone|setup|psu|power supply|should i buy|thoughts|fan noise|case build|help me)/i.test(fullText)) score -= 20;
		else score -= 5;
	}

	// 旧 Issue
	if (item.issueType === 'old') score -= 15;

	// 新闻站：与 Intel GPU 无关的直接重罚
	if ((source.includes('phoronix') || source.includes('techpowerup')) && !isIntelGpuRelated(`${title} ${summary}`)) {
		score -= 40;
	}

	// 加分
	if (source.includes('techpowerup') && /(?:driver|drivers|whql|game ready|beta release)/i.test(fullText)) score += 20;
	if (source.includes('phoronix') && /(?:drm\/xe|mesa|anv|kernel|vram|fred|xe2|xe3)/i.test(fullText)) score += 15;
	if (/(?:crash|freeze|hang|regression|black screen|bsod|segfault|corruption|deadlock|data loss|stutter)/i.test(fullText)) score += 18;
	if (source.includes('上游合入') || source.includes('triton')) score += 15;
	if (/(?:workaround|fallback|revert|root cause|hotfix|security advisory)/i.test(fullText)) score += 14;
	if (/(?:triton|xpu|sycl|kernel|subgroup|xmx|esimd|usm|anv|kv cache|attention|quant|moe|fp8|int8|int4)/i.test(fullText)) score += 10;
	if (source.includes('release') && !/(?:nightly|snapshot|latest-good|latest-buildable)/i.test(fullText)) score += 15;

	if (matchedThreads && matchedThreads.length > 0) score += 20;

	return score;
}

export function filterAndRankItems(items, threads = [], minScore = 15, limit = 20) {
	return items
		.map(item => {
			const matchedThreads = matchNewsThreads(item, threads);
			return { ...item, matchedThreads, score: scoreItemImportance(item, matchedThreads) };
		})
		.filter(item => item.score >= minScore)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

/**
 * 给候选条目分配稳定引用 ID（s1, s2, ...），LLM 只回传 ref
 */
export function assignRefs(items) {
	return items.map((it, idx) => ({ ...it, ref: `s${idx + 1}` }));
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export function buildDailyPrompts(items, todayStr, history) {
	const promptData = items.map((it) => {
		let threadInfo = '';
		if (it.matchedThreads && it.matchedThreads.length > 0) {
			const th = it.matchedThreads[0];
			const latest = th.history?.[th.history.length - 1];
			threadInfo = `\n关联追踪事件: threadId="${th.id}"，${th.title}；此前阶段：[${latest?.stage || th.status}] ${latest?.note || ''}`;
		}
		return `[${it.ref}] 来源: ${it.source}
标题: ${it.title}
时间: ${it.updated}
摘要: ${it.summary ? it.summary.replace(/\s+/g, ' ') : '无摘要'}${threadInfo}
---`;
	}).join('\n');

	const yesterday = history?.yesterdayHighlights
		? `\n【昨日已报道要点，禁止重复作为今日要点】\n${history.yesterdayHighlights}\n`
		: '';

	const systemPrompt = `你是一名熟悉 GPU 架构、深度学习编译器和 Intel GPU 软件栈的系统工程师，为《Intel GPU 技术生态日报》做技术编辑。
你只负责理解和提炼，排版、分组、链接由程序完成。必须输出纯 JSON，不要任何 Markdown 外壳。
${yesterday}
【JSON 结构】
{
  "overview": [
    { "status": "Merged", "title": "不超过 30 字的结论句", "refs": ["s1"] }
  ],
  "items": [
    {
      "refs": ["s1"],
      "title": "改动主题，不超过 30 字，不要写模块名前缀",
      "analysis": "做了什么、为什么（根因），2~3 句，只写信源能支持的内容",
      "impact": "谁受影响、需要做什么；写不出具体对象就填 null",
      "brief": "不超过 25 字的一句话，用于次要条目",
      "tier": "major",
      "changeType": "feature",
      "isTrueFix": true,
      "claimOwner": "maintainer",
      "rootCauseConfirmed": true,
      "threadId": null
    }
  ]
}

【字段约束】
- refs：只能使用输入中出现的 ID（如 "s3"）。同一件事的多条信源（例如版本号提升 + 对应依赖更新）合并为一个 item，refs 写多个。
- overview：1~3 条，只放今天最值得看的结论；title 是结论而不是标题复述。内容少就少写，不要凑数。
- status 只允许 "Merged" | "Released" | "Workaround" | "Issue" | "Testing"。
- tier："major" 表示影响实际使用、性能、正确性或兼容性；测试放宽、跳过测试、CI 调整、上游同步、构建告警一律 "minor"。
- changeType："feature" | "bugfix" | "workaround" | "test_fix" | "ci" | "sync" | "driver_update" | "issue_report"。
- impact：禁止空话（如「可能包含性能改进」「提高正确性」「简化 CI」）。没有具体受影响对象就填 null。minor 条目 impact 填 null。

【事实纪律】
- 报告者提交、维护者未确认的问题（claimOwner="reporter"，rootCauseConfirmed=false），analysis 只能写「报告者认为……」，不得给出根因结论，也不得自行推测根因。
- 上层绕行或条件规避：isTrueFix=false，analysis 中写明是规避。
- 测试放宽或跳过：写明「属于测试调整，根因未解决」。
- 禁止公关套话（重磅、里程碑、颠覆性、赋能）和「不是……而是……」句式。`;

	const userPrompt = `今日候选信源如下（已按重要性排序），请输出 JSON：\n\n${promptData}`;

	return { systemPrompt, userPrompt };
}

// ---------------------------------------------------------------------------
// JSON 解析与校验
// ---------------------------------------------------------------------------

export function parseDailyJsonOutput(rawResponse) {
	if (!rawResponse || typeof rawResponse !== 'string') {
		throw new Error('LLM 返回内容为空');
	}
	let cleaned = rawResponse.trim()
		.replace(/^```(?:json)?\s*\r?\n/i, '')
		.replace(/\r?\n```\s*$/i, '')
		.trim();
	const first = cleaned.indexOf('{');
	const last = cleaned.lastIndexOf('}');
	if (first !== -1 && last > first) cleaned = cleaned.slice(first, last + 1);
	try {
		return JSON.parse(cleaned);
	} catch (err) {
		throw new Error(`无法解析模型输出的 JSON: ${err.message}\n原始文本: ${rawResponse.slice(0, 300)}`);
	}
}

function itemRefs(it) {
	if (Array.isArray(it.refs) && it.refs.length > 0) return it.refs;
	if (it.ref) return [it.ref];
	if (it.sourceUrl) return [it.sourceUrl];
	return [];
}

/**
 * 校验并清洗 LLM JSON：丢弃引用了不存在 ref 的条目（防止编造信源）
 * @param {object} data LLM 输出
 * @param {Array} sources 带 ref 的候选条目
 */
export function validateDailyJson(data, sources = null) {
	const errors = [];
	const warnings = [];

	if (!data || typeof data !== 'object') {
		return { isValid: false, errors: ['数据不是合法的 JSON 对象'], warnings, data };
	}

	const refSet = sources ? new Set(sources.map(s => s.ref)) : null;
	const keepRefs = (refs) => (refSet ? refs.filter(r => refSet.has(r)) : refs);

	const items = (Array.isArray(data.items) ? data.items : []).filter((it, idx) => {
		if (!it || !it.title || !it.analysis) {
			warnings.push(`items[${idx}] 缺少 title/analysis，已丢弃`);
			return false;
		}
		let refs = keepRefs(itemRefs(it));
		if (refs.length === 0) {
			if (!sources) {
				refs = [`item-${idx}`];
			} else {
				warnings.push(`items[${idx}]「${it.title}」没有有效 ref，已丢弃`);
				return false;
			}
		}
		it.refs = refs;
		return true;
	});

	const overview = (Array.isArray(data.overview) ? data.overview : []).filter((ov, idx) => {
		if (!ov || !ov.title) {
			warnings.push(`overview[${idx}] 缺少 title，已丢弃`);
			return false;
		}
		ov.refs = keepRefs(itemRefs(ov));
		if (!ALLOWED_STATUS_BADGES.includes(ov.status)) {
			warnings.push(`overview[${idx}] status "${ov.status}" 不在白名单，将被规范化`);
		}
		return true;
	}).slice(0, 3);

	if (items.length === 0) errors.push('没有任何可用的正文条目');
	if (overview.length === 0 && items.length > 0) {
		warnings.push('overview 为空，将由首条正文条目生成');
		overview.push({ status: 'Merged', title: items[0].title, refs: items[0].refs });
	}

	const cleaned = { ...data, overview, items };
	return { isValid: errors.length === 0, errors, warnings, data: cleaned };
}

// ---------------------------------------------------------------------------
// 渲染
// ---------------------------------------------------------------------------

function yamlString(s) {
	return JSON.stringify(String(s));
}

export function buildDescription(overview = []) {
	const titles = overview.map(o => String(o.title).trim().replace(/[。.]$/, '')).filter(Boolean);
	if (titles.length === 0) return '今日 Intel GPU 软件栈与驱动动态。';
	const text = titles.join('；');
	return text.length > 120 ? `${text.slice(0, 118)}…` : text;
}

/**
 * 程序渲染 Markdown
 * @param {object} jsonData 已通过 validateDailyJson 清洗的数据
 * @param {string} todayStr YYYY-MM-DD
 * @param {Array} threads 线程库
 * @param {Array} sources 带 ref 的候选条目（提供 source/url）
 */
export function renderDailyMarkdown(jsonData, todayStr, threads = [], sources = []) {
	const threadMap = new Map((threads || []).map(t => [t.id, t]));
	const sourceMap = new Map((sources || []).map(s => [s.ref, s]));

	const getSourceLinks = (it) => {
		const refs = it.refs || [];
		if (refs.length > 0 && sourceMap.size > 0) {
			const found = refs.map(r => sourceMap.get(r)).filter(Boolean);
			if (found.length > 0) {
				return found.map(s => `[${deriveLinkLabel(s.url, s.source)}](${s.url})`).join(' · ');
			}
		}
		if (it.sourceUrl) {
			const label = it.sourceLabel || deriveLinkLabel(it.sourceUrl, it.module || '');
			return `[[${label}](${it.sourceUrl})]`;
		}
		return '';
	};

	// 1. 归位：section / module 由第一个 ref 的来源决定
	const placed = (jsonData.items || []).map(it => {
		const refs = itemRefs(it);
		const first = refs.length > 0 ? sourceMap.get(refs[0]) : null;
		let { section, module } = first ? classifySource(first?.source || '') : {};
		section = section || it.section || 'ecosystem';
		module = module || it.module || '生态与驱动进展';
		return { ...it, refs, section, module, minor: isMinorItem(it) };
	});

	// ref → 模块锚点，供速览跳转
	const refAnchor = new Map();
	for (const it of placed) {
		for (const r of it.refs) {
			if (!refAnchor.has(r)) refAnchor.set(r, slugifyHeading(it.module));
		}
	}

	const overview = jsonData.overview || [];

	let md = `---
title: ${yamlString(`Intel GPU 技术生态日报 (${todayStr})`)}
description: ${yamlString(buildDescription(overview))}
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

## 核心速览

`;

	for (const ov of overview) {
		const normStatus = normalizeStatusBadge(ov.status);
		const badgeHtml = renderBadge(normStatus);
		const anchor = ov.refs?.map(r => refAnchor.get(r)).find(Boolean);
		const jump = anchor ? ` [详情 →](#${anchor})` : '';
		const summary = ov.summary ? `：${ov.summary.trim()}` : '';
		md += `- ${badgeHtml} **${String(ov.title).trim()}**${summary}${jump}\n`;
	}
	md += '\n';

	// 2. 板块 → 模块 → 重点 / 次要
	for (const secKey of SECTION_ORDER) {
		const secItems = placed.filter(it => it.section === secKey);
		if (secItems.length === 0) continue;

		md += `## ${SECTION_TITLES[secKey]}\n\n`;

		const modules = [...new Set(secItems.map(it => it.module))];
		for (const mod of modules) {
			const modItems = secItems.filter(it => it.module === mod);
			const major = modItems.filter(it => !it.minor);
			const minor = modItems.filter(it => it.minor);

			md += `### ${mod}\n\n`;

			for (const it of major) {
				const src = getSourceLinks(it);
				const linkSuffix = src ? ` ${src}` : '';
				md += `- **${it.title.trim()}**：${it.analysis.trim()}${linkSuffix}\n`;
				if (!isHollowImpact(it.impact)) {
					md += `\n  > **影响：** ${it.impact.trim()}\n`;
				}
				if (it.threadId && threadMap.has(it.threadId)) {
					const th = threadMap.get(it.threadId);
					const latest = th.history?.[th.history.length - 1];
					const note = latest?.note ? `（此前阶段：${latest.note}）` : '';
					md += `\n  > 🔗 **续报（关联 ${latest?.date || th.lastUpdated} 日报）：** 事件跟踪【${th.title}】新进展${note}。\n`;
				}
				md += '\n';
			}

			if (minor.length > 0) {
				const label = major.length > 0 ? `其他 ${minor.length} 项小改动` : `${minor.length} 项小改动`;
				md += `<details class="news-minor">\n<summary>${label}</summary>\n\n`;
				for (const it of minor) {
					const brief = it.brief && String(it.brief).trim() ? `：${String(it.brief).trim()}` : '';
					const src = getSourceLinks(it);
					const linkSuffix = src ? ` ${src}` : '';
					md += `- ${it.title.trim()}${brief}${linkSuffix}\n`;
				}
				md += `\n</details>\n\n`;
			}
		}
	}

	return md.trim() + '\n';
}

// ---------------------------------------------------------------------------
// 发布前硬门禁
// ---------------------------------------------------------------------------

/**
 * 当天没有达到门槛的动态时的简报（不调用 LLM）
 */
export function renderQuietDayMarkdown(todayStr, candidateCount = 0) {
	const reason = candidateCount > 0
		? `过去 28 小时抓取到 ${candidateCount} 条候选，经去重与重要性筛选后均未达到收录标准（多为 CI 调整、每日构建快照或与 Intel GPU 无关的新闻）。`
		: '过去 28 小时没有抓取到新的动态，或全部已在往期报道。';
	return `---
title: ${yamlString(`Intel GPU 技术生态日报 (${todayStr})`)}
description: "今日无重要更新。"
pubDate: "${todayStr}T08:30:00.000Z"
tags:
  - Intel
  - GPU
  - 日报
categories:
  - 技术日报
  - 显卡
draft: false
---

## 今日要点

今日无值得单独报道的更新。

${reason}
`;
}

export function validateDailyMarkdown(markdown) {
	const errors = [];
	const warnings = [];

	if (!markdown.startsWith('---') || !markdown.includes('title:') || !markdown.includes('pubDate:')) {
		errors.push('缺少标准 YAML Frontmatter (title/pubDate)');
	}
	if (!markdown.includes('## 核心速览') && !markdown.includes('## 今日要点')) {
		errors.push('缺少 "## 核心速览" 或 "## 今日要点" 二级标题');
	}

	const overviewMatch = markdown.match(/## (?:核心速览|今日要点)([\s\S]*?)(?=\n## |$)/);
	if (overviewMatch) {
		const lines = overviewMatch[1].split('\n').filter(l => l.trim().startsWith('- '));
		if (lines.length === 0) errors.push('核心速览为空');
		const allowedLower = ALLOWED_STATUS_BADGES.map(b => b.toLowerCase()).join("|");
		const allowedUpper = ALLOWED_STATUS_BADGES.join("|");
		const badgeRe = new RegExp('class="news-badge news-badge--(' + allowedLower + ')"|\\*\\*`\\\[(' + allowedUpper + ')\\\]`\\*\\*');
		lines.forEach((l, i) => {
			if (!badgeRe.test(l)) errors.push(`核心速览第 ${i + 1} 条缺少受控状态 Badge`);
		});
	}

	if (!/\n## (?!核心速览|今日要点)/.test(markdown)) {
		errors.push('缺少正文板块（至少需要一个正文二级标题）');
	}

	const forbiddenPhrases = [
		'不是……而是……',
		'不是...而是...',
		'不是普通的更新，而是',
		'重磅来袭',
		'赋予新生命',
		'颠覆性',
		'划时代',
		'全面赋能',
		'里程碑式的飞跃',
	];
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
