import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';

// 读取本地 .env 文件（若存在）
function loadEnv() {
	const envPath = path.resolve('.env');
	if (fs.existsSync(envPath)) {
		const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;
			const idx = trimmed.indexOf('=');
			if (idx !== -1) {
				const key = trimmed.slice(0, idx).trim();
				const val = trimmed.slice(idx + 1).trim();
				if (!process.env[key]) {
					process.env[key] = val;
				}
			}
		}
	}
}

loadEnv();

const RADEON_API_KEY = process.env.RADEON_API_KEY;
const RADEON_BASE_URL = process.env.RADEON_BASE_URL || 'https://developer.amd.com.cn/radeon/api/v1';
const RADEON_MODEL = process.env.RADEON_MODEL || 'DeepSeek-V4-Flash';

if (!RADEON_API_KEY) {
	console.error('\x1b[31m[Error] 缺少 RADEON_API_KEY 环境变量！\x1b[0m');
	process.exit(1);
}

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
});

const FETCH_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept': 'application/xml, application/json, text/xml, */*',
};

if (process.env.GITHUB_TOKEN) {
	FETCH_HEADERS['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
}

// 时间窗口：拉取过去 28 小时（覆盖一天并留 4 小时容错，杜绝抓取前天内容）
const TIME_WINDOW_HOURS = 28;
const cutoffDate = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);

// 从历史已发布的日报中提取已收录的链接与关键特征
function loadReportedHistory(currentDateStr) {
	const newsDir = path.resolve('src/content/news');
	const seenUrls = new Set();
	const seenKeys = new Set();
	let yesterdayHighlights = '';

	if (!fs.existsSync(newsDir)) return { seenUrls, seenKeys, yesterdayHighlights };

	const files = fs.readdirSync(newsDir)
		.filter(f => f.startsWith('intel-gpu-daily-') && f.endsWith('.md') && f !== `intel-gpu-daily-${currentDateStr}.md`)
		.sort((a, b) => b.localeCompare(a)); // 倒序，第一篇是昨天的

	for (let i = 0; i < files.length; i++) {
		const filePath = path.join(newsDir, files[i]);
		const content = fs.readFileSync(filePath, 'utf-8');

		// 提取所有 markdown 链接: [text](URL)
		const urlMatches = content.matchAll(/\((https?:\/\/[^\s\)]+)\)/g);
		for (const match of urlMatches) {
			const cleanUrl = match[1].replace(/\/+$/, '').toLowerCase();
			seenUrls.add(cleanUrl);

			// 提取 PR 或 commit 特征，如 /pull/12345 或 /commit/abc1234
			const prMatch = cleanUrl.match(/\/pull\/(\d+)/);
			if (prMatch) seenKeys.add(`pr:${prMatch[1]}`);
			const commitMatch = cleanUrl.match(/\/commit\/([a-f0-9]{7,40})/);
			if (commitMatch) seenKeys.add(`commit:${commitMatch[1].slice(0, 7)}`);
		}

		// 提取最新一期（即昨日）的核心速览部分
		if (i === 0) {
			const coreMatch = content.match(/## 核心速览([\s\S]*?)(?=##|$)/);
			if (coreMatch) {
				yesterdayHighlights = coreMatch[1].trim();
			}
		}
	}

	return { seenUrls, seenKeys, yesterdayHighlights };
}

// --- 1. 抓取逻辑 ---

// 1.1 GitHub Atom Releases
const ATOM_REPOS = [
	'intel/llm-scaler',
	'intel/intel-xpu-backend-for-triton',
	'intel/compute-runtime',
	'intel/intel-graphics-compiler',
	'intel/llvm',
	'oneapi-src/oneDNN',
	'oneapi-src/oneMKL',
	'oneapi-src/level-zero',
	'openvinotoolkit/openvino',
	'openvinotoolkit/openvino.genai',
];

async function fetchAtomReleases(repo) {
	const url = `https://github.com/${repo}/releases.atom`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const xml = await res.text();
		const parsed = parser.parse(xml);
		const entries = parsed.feed?.entry;
		if (!entries) return [];

		const entryList = Array.isArray(entries) ? entries : [entries];
		const results = [];
		for (const e of entryList) {
			const updated = new Date(e.updated || e.published);
			if (updated >= cutoffDate) {
				results.push({
					source: `GitHub Release: ${repo}`,
					title: e.title,
					url: e.link?.['@_href'] || e.link,
					updated: updated.toISOString(),
					summary: typeof e.content === 'string' ? e.content.replace(/<[^>]+>/g, '').slice(0, 300) : '',
				});
			}
		}
		return results;
	} catch (err) {
		console.warn(`[Atom] ${repo} 抓取警告:`, err.message);
		return [];
	}
}

// 1.2.1 intel/llm-scaler 最新 Commits
async function fetchLlmScalerCommits() {
	const sinceStr = cutoffDate.toISOString();
	const url = `https://api.github.com/repos/intel/llm-scaler/commits?since=${sinceStr}&per_page=20`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const commits = await res.json();
		if (!Array.isArray(commits)) return [];
		return commits
			.filter(c => {
				const msg = c.commit?.message || '';
				// 过滤纯更新版本号或简单 merge、readme
				return !/^update readme/i.test(msg) && !/^merge /i.test(msg);
			})
			.map(c => ({
				source: 'intel/llm-scaler (Commit/Patch)',
				title: c.commit?.message?.split('\n')[0] || 'Untitled commit',
				url: c.html_url,
				updated: c.commit?.author?.date,
				summary: c.commit?.message?.slice(0, 250),
			}));
	} catch (err) {
		console.warn('[llm-scaler commits] 抓取警告:', err.message);
		return [];
	}
}

// 1.2.2 intel/intel-xpu-backend-for-triton 最新 Commits
async function fetchTritonXpuCommits() {
	const sinceStr = cutoffDate.toISOString();
	const url = `https://api.github.com/repos/intel/intel-xpu-backend-for-triton/commits?since=${sinceStr}&per_page=20`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const commits = await res.json();
		if (!Array.isArray(commits)) return [];
		return commits
			.filter(c => {
				const msg = c.commit?.message || '';
				return !/^update readme/i.test(msg) && !/^merge /i.test(msg);
			})
			.map(c => ({
				source: 'intel/intel-xpu-backend-for-triton (Commit/Patch)',
				title: c.commit?.message?.split('\n')[0] || 'Untitled commit',
				url: c.html_url,
				updated: c.commit?.author?.date,
				summary: c.commit?.message?.slice(0, 250),
			}));
	} catch (err) {
		console.warn('[triton commits] 抓取警告:', err.message);
		return [];
	}
}

// 1.3 上游框架与模型生态 PR
const SEARCH_QUERIES = [
	{
		label: 'PyTorch (torch.xpu)',
		query: `repo:pytorch/pytorch is:pr is:merged label:"module: xpu" merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'vLLM (upstream XPU)',
		query: `repo:vllm-project/vllm is:pr is:merged (xpu OR "intel gpu") in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'llama.cpp (sycl/openvino/intel)',
		query: `repo:ggerganov/llama.cpp is:pr is:merged (sycl OR openvino OR "intel gpu") in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'SGLang (XPU)',
		query: `repo:sgl-project/sglang is:pr is:merged (xpu OR "intel gpu") in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'ComfyUI (Intel/XPU)',
		query: `repo:comfyanonymous/ComfyUI is:pr is:merged (xpu OR intel) in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'Ollama (SYCL/Intel)',
		query: `repo:ollama/ollama is:pr is:merged (sycl OR intel OR oneapi) in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'DeepSpeed (XPU)',
		query: `repo:microsoft/DeepSpeed is:pr is:merged xpu in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
];

async function fetchSearchPRs(label, query) {
	const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=10`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const data = await res.json();
		if (!data.items || !Array.isArray(data.items)) return [];

		return data.items.map(item => ({
			source: `上游合入: ${label}`,
			title: item.title,
			url: item.html_url,
			updated: item.closed_at || item.updated_at,
			summary: item.body ? item.body.replace(/<[^>]+>/g, '').slice(0, 250) : '',
		}));
	} catch (err) {
		console.warn(`[GitHub Search] ${label} 抓取警告:`, err.message);
		return [];
	}
}

// 1.4 Phoronix RSS (过滤仅包含图形/显卡/Intel 驱动的内容)
async function fetchPhoronix() {
	const url = 'https://www.phoronix.com/rss.php';
	const intelKeywords = ['intel', 'arc', 'xe', 'battlemage', 'panther lake', 'lunar lake', 'anv', 'i915', 'oneapi', 'level zero', 'xe2'];
	const excludeKeywords = ['apple silicon', 'risc-v', 'snapdragon', 'qualcomm', 'raspberry pi', 'radeon', 'amdgpu', 'geforce', 'nvidia'];
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const xml = await res.text();
		const parsed = parser.parse(xml);
		const items = parsed.rss?.channel?.item;
		if (!items) return [];

		const itemList = Array.isArray(items) ? items : [items];
		const results = [];
		for (const item of itemList) {
			const pubDate = new Date(item.pubDate);
			if (pubDate < cutoffDate) continue;

			const titleLower = (item.title || '').toLowerCase();
			const descLower = (item.description || '').toLowerCase();
			const fullText = `${titleLower} ${descLower}`;

			const isExcluded = excludeKeywords.some(ex => titleLower.includes(ex));
			if (isExcluded) continue;

			const isIntelGpuRelated = intelKeywords.some(k => fullText.includes(k));
			if (isIntelGpuRelated) {
				results.push({
					source: 'Phoronix (Linux Graphics/Driver)',
					title: item.title,
					url: item.link,
					updated: pubDate.toISOString(),
					summary: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 250),
				});
			}
		}
		return results;
	} catch (err) {
		console.warn('[Phoronix] 抓取警告:', err.message);
		return [];
	}
}

// 1.5 TechPowerUp News RSS (Windows Intel 显卡驱动与硬件发布第一时间监控)
async function fetchTechPowerUpDrivers() {
	const url = 'https://www.techpowerup.com/rss/news';
	const intelKeywords = ['intel', 'arc', 'battlemage', 'alchemist'];
	const driverKeywords = ['driver', 'drivers', 'whql', 'game on', 'graphics'];
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const xml = await res.text();
		const parsed = parser.parse(xml);
		const items = parsed.rss?.channel?.item;
		if (!items) return [];

		const itemList = Array.isArray(items) ? items : [items];
		const results = [];
		for (const item of itemList) {
			const pubDate = new Date(item.pubDate);
			if (pubDate < cutoffDate) continue;

			const titleLower = (item.title || '').toLowerCase();
			const descLower = (item.description || '').toLowerCase();
			const fullText = `${titleLower} ${descLower}`;

			const hasIntel = intelKeywords.some(k => titleLower.includes(k));
			const hasDriver = driverKeywords.some(k => fullText.includes(k));
			if (hasIntel && hasDriver) {
				results.push({
					source: 'TechPowerUp (Windows 驱动与硬件)',
					title: item.title,
					url: item.link,
					updated: pubDate.toISOString(),
					summary: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
				});
			}
		}
		return results;
	} catch (err) {
		console.warn('[TechPowerUp] 抓取警告:', err.message);
		return [];
	}
}

// 1.6 Intel GPU Community Issue Tracker (IGCIT) (监控 Windows 驱动实际 Bug/BSOD 与修复进展)
async function fetchIGCITIssues() {
	const sinceStr = cutoffDate.toISOString();
	const url = `https://api.github.com/repos/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues?since=${sinceStr}&per_page=10`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const issues = await res.json();
		if (!Array.isArray(issues)) return [];

		return issues.map(item => ({
			source: 'Intel 官方社区驱动追踪 (IGCIT)',
			title: item.title,
			url: item.html_url,
			updated: item.updated_at,
			summary: item.body ? item.body.replace(/<[^>]+>/g, '').slice(0, 250) : '',
		}));
	} catch (err) {
		console.warn('[IGCIT] 抓取警告:', err.message);
		return [];
	}
}

// 1.5 Reddit r/IntelArc (过滤硬核测试、工具更新和特定驱动讨论)
async function fetchRedditArc() {
	const url = 'https://www.reddit.com/r/IntelArc/.rss';
	const valuableKeywords = ['benchmark', 'tok/s', 'vllm', 'sycl', 'overclock', 'arc power', 'fix', 'driver', 'performance', 'linux', 'b580', 'b570', 'b70', 'b60', 'a770'];
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const xml = await res.text();
		const parsed = parser.parse(xml);
		const entries = parsed.feed?.entry;
		if (!entries) return [];

		const entryList = Array.isArray(entries) ? entries : [entries];
		const results = [];
		for (const e of entryList) {
			const updated = new Date(e.updated || e.published);
			if (updated < cutoffDate) continue;

			const titleLower = (e.title || '').toLowerCase();
			const matched = valuableKeywords.some(k => titleLower.includes(k));
			// 过滤纯提问与低质贴
			if (!matched || titleLower.startsWith('help') || titleLower.startsWith('can’t play') || titleLower.includes('is a 500wat')) continue;

			results.push({
				source: 'Reddit r/IntelArc (社区实测与讨论)',
				title: e.title,
				url: e.link?.['@_href'] || e.link,
				updated: updated.toISOString(),
				summary: typeof e.content === 'string' ? e.content.replace(/<[^>]+>/g, '').slice(0, 200) : '',
			});
		}
		return results;
	} catch (err) {
		console.warn('[Reddit] 抓取警告:', err.message);
		return [];
	}
}

// --- 2. 汇总与组装 ---
async function collectAllUpdates(history) {
	console.log('[1/4] 正在并发采集 Intel GPU 生态动态...');
	const rawItems = [];

	const [atoms, llmCommits, tritonCommits, phoronix, techpowerup, igcit, reddit] = await Promise.all([
		Promise.all(ATOM_REPOS.map(fetchAtomReleases)),
		fetchLlmScalerCommits(),
		fetchTritonXpuCommits(),
		fetchPhoronix(),
		fetchTechPowerUpDrivers(),
		fetchIGCITIssues(),
		fetchRedditArc(),
	]);

	for (const a of atoms) rawItems.push(...a);
	rawItems.push(...llmCommits);
	rawItems.push(...tritonCommits);
	rawItems.push(...phoronix);
	rawItems.push(...techpowerup);
	rawItems.push(...igcit);
	rawItems.push(...reddit);

	// 上游 PR 逐个执行（微小间隔防 403）
	for (const sq of SEARCH_QUERIES) {
		const prs = await fetchSearchPRs(sq.label, sq.query);
		rawItems.push(...prs);
	}

	// 按 URL 与历史已报道记录进行深度去重
	const seenUrls = new Set();
	const deduplicated = [];
	let skippedHistoryCount = 0;

	for (const item of rawItems) {
		if (!item.url) continue;
		const cleanUrl = item.url.replace(/\/+$/, '').toLowerCase();

		// 1. 检查是否在历史日报中已引用该链接
		if (history.seenUrls.has(cleanUrl)) {
			skippedHistoryCount++;
			continue;
		}

		// 2. 检查 PR 编号是否已被收录
		const prMatch = cleanUrl.match(/\/(?:pull|issues)\/(\d+)/);
		if (prMatch && history.seenKeys.has(`pr:${prMatch[1]}`)) {
			skippedHistoryCount++;
			continue;
		}

		// 3. 检查 commit hash 是否已被收录
		const commitMatch = cleanUrl.match(/\/commit\/([a-f0-9]{7,40})/);
		if (commitMatch && history.seenKeys.has(`commit:${commitMatch[1].slice(0, 7)}`)) {
			skippedHistoryCount++;
			continue;
		}

		// 4. 本次采集内部去重
		if (!seenUrls.has(cleanUrl)) {
			seenUrls.add(cleanUrl);
			deduplicated.push(item);
		}
	}

	console.log(`[1/4] 采集完成: 原始抓取 ${rawItems.length} 条，过滤历史已报道 ${skippedHistoryCount} 条，最终清洗出 ${deduplicated.length} 条今日新增动态。`);
	return deduplicated;
}

// --- 3. 调用 Radeon Cloud LLM 生成 Markdown ---
async function generateSummaryWithLLM(items, todayStr, history) {
	console.log(`[2/4] 调用 Radeon Cloud API (${RADEON_MODEL}) 进行高信息密度技术提炼 (已排除历史重复)...`);

	const promptData = items.map((it, idx) => `[${idx + 1}] 来源: ${it.source}
标题: ${it.title}
链接: ${it.url}
时间: ${it.updated}
摘要: ${it.summary.replace(/\s+/g, ' ')}
---`).join('\n');

	const yesterdayHighlightsPrompt = history.yesterdayHighlights
		? `\n【往期（昨日）已报道核心速览 - 严禁重复！】\n以下是上一期日报已报道的关键内容，今天绝对禁止再次作为主要新闻重复报道：\n${history.yesterdayHighlights}\n`
		: '';

	const systemPrompt = `你是一名精通底层系统编程、GPU 架构与深度学习编译器的工程师，深度关注 Intel GPU（Arc 独显如 Battlemage/Alchemist、核显如 Lunar Lake/Arrow Lake、数据中心 GPU）及其 AI 软件栈（oneAPI、SYCL、XPU、Triton、oneDNN、oneMKL、OpenVINO GenAI、vLLM、SGLang、ComfyUI、llama.cpp、Ollama、Windows 驱动、Linux drm/xe 驱动）。

你的任务：根据提供的过去 24 小时内真正新增的信源列表，撰写一篇专业、严谨、低“AI味”的《Intel GPU 技术生态日报》。
${yesterdayHighlightsPrompt}
【严格去重与反“炒冷饭”原则 - 核心红线】
1. 严禁炒冷饭：今日日报只报道今天新发生的代码改动、新 PR 或新基准。如果某事件在往期已报道列表中已出现，坚决不准再次将其作为重点展开。
2. 宁缺毋滥：若某个板块今天确实没有产生新的有效 PR 或特性，请直接忽略该二级标题，切勿无中生有或复述旧闻凑字数。
3. 严禁宣传公关套话（如“重磅来袭”、“里程碑”、“颠覆性”、“赋予新生命”、“赋能”等）。
4. 严禁使用“不是……而是……”、“不仅如此……”、“总的来说……”、“正如大家所知……”等机械说教句式与任何文学比喻。
5. 客观陈述技术事实：保留精确术语（如 ESIMD, Subgroup, XMX, Level Zero, SYCL, USM, DP, MTP, KV Cache, drm/xe, ANV）。
6. 条目格式：
   - **[组件/模块] 改动主题**：核心技术分析与改动动机。[[PR/Release 简写](链接)]

【文章结构规范】
你必须直接输出完整的 Markdown 文件内容，包含合规的 YAML Frontmatter：
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

正文使用清晰的二级标题组织（以触发博客右侧 TOC 目录导航，无更新的板块直接省略）：
## 核心速览
(用 2~3 条极为简炼的要点概括今日最关键的技术新进展)

## 下游优化与加速库 (intel/llm-scaler / Triton / OpenVINO)
(分析 intel/llm-scaler、Triton XPU 后端、OpenVINO GenAI 今日新提交的 patch 或 Release)

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp / Ollama)
(分析今日合并至上游官方仓的 XPU / SYCL PR)

## 驱动、内核与图形栈 (Windows 驱动 / Linux drm/xe / Mesa ANV)
(分析今日 Windows 显卡驱动发布、Bug 修复追踪、Linux 内核驱动或 Mesa 的新技术变动)

## 社区实测与生态动态
(精选今日社区有技术价值的新测试、新工具或真实反馈)`;

	const userPrompt = `以下是今日收集到的去重后最新信源列表，请严格按照上述要求提炼并生成完整 Markdown：\n\n${promptData}`;

	let response;
	let attempts = 0;
	const maxAttempts = 3;
	while (attempts < maxAttempts) {
		attempts++;
		try {
			response = await fetch(`${RADEON_BASE_URL}/chat/completions`, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${RADEON_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: RADEON_MODEL,
					messages: [
						{ role: 'system', content: systemPrompt },
						{ role: 'user', content: userPrompt },
					],
					temperature: 0.2, // 保持低温度以确保严谨无幻觉
					max_tokens: 3000,
				}),
			});

			if (response.status === 429 || response.status >= 500) {
				const errBody = await response.text();
				console.warn(`[Radeon Cloud] 收到 ${response.status} 状态，准备进行重试 (${attempts}/${maxAttempts})... 响应: ${errBody.slice(0, 100)}`);
				if (attempts < maxAttempts) {
					await new Promise(r => setTimeout(r, attempts * 4000));
					continue;
				}
				throw new Error(`Radeon Cloud API 请求失败 (${response.status}): ${errBody}`);
			}
			break;
		} catch (err) {
			if (attempts >= maxAttempts) throw err;
			console.warn(`[Radeon Cloud] 请求异常，重试中 (${attempts}/${maxAttempts}): ${err.message}`);
			await new Promise(r => setTimeout(r, attempts * 4000));
		}
	}

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Radeon Cloud API 请求失败 (${response.status}): ${errText}`);
	}

	const data = await response.json();
	const content = data.choices?.[0]?.message?.content;
	if (!content) {
		throw new Error('LLM 未返回有效内容');
	}

	return content;
}

// 清理 Markdown 代码块外框及多余包裹标记
function sanitizeMarkdown(text) {
	let cleaned = text.trim();
	// 剔除可能存在的最外层 ```markdown 或 ``` 标记
	cleaned = cleaned.replace(/^```(?:markdown)?\s*\r?\n/i, '');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');

	// 处理偶然出现的嵌套异常包装，如 "---\n```markdown\n---"
	cleaned = cleaned.replace(/^---\s*\r?\n```(?:markdown)?\s*\r?\n---/i, '---');
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');

	// 确保定位到首个 --- Frontmatter 起始
	const firstYamlIndex = cleaned.indexOf('---');
	if (firstYamlIndex > 0) {
		cleaned = cleaned.slice(firstYamlIndex);
	}

	// 核心安全强化：如果开头连续出现多个 --- 分隔符（如 ---\n---），仅保留单个 ---
	cleaned = cleaned.replace(/^(\s*---\s*\r?\n)+/, '---\n');

	// 剔除尾部可能残留的代码块闭合标记
	cleaned = cleaned.replace(/\r?\n```\s*$/i, '');

	return cleaned.trim();
}

// --- 4. 主流程执行 ---
async function main() {
	const today = new Date();
	const yyyy = today.getFullYear();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const todayStr = `${yyyy}-${mm}-${dd}`;

	const history = loadReportedHistory(todayStr);
	console.log(`[Deduplicate] 从历史日报中提取了 ${history.seenUrls.size} 个已报道链接和 ${history.seenKeys.size} 个特征键。`);

	const items = await collectAllUpdates(history);
	if (items.length === 0) {
		console.log('[Notice] 过去 28 小时内所有动态均已在往期日报中报道，今日无新增动态，跳过日报生成。');
		return;
	}

	const generatedContent = await generateSummaryWithLLM(items, todayStr, history);
	const sanitized = sanitizeMarkdown(generatedContent);

	const outputFileName = `intel-gpu-daily-${todayStr}.md`;
	const newsDir = path.resolve('src/content/news');
	if (!fs.existsSync(newsDir)) {
		fs.mkdirSync(newsDir, { recursive: true });
	}
	const outputPath = path.join(newsDir, outputFileName);

	fs.writeFileSync(outputPath, sanitized, 'utf-8');
	console.log(`\x1b[32m[3/4] 成功生成日报文件: ${outputPath}\x1b[0m`);

	console.log('[4/4] 正在验证生成内容格式...');
	if (sanitized.includes('---') && sanitized.includes('title:')) {
		console.log('\x1b[32m✔ Frontmatter 验证通过\x1b[0m');
	} else {
		console.warn('\x1b[33m⚠ 警告: 生成的文章可能缺少标准 Frontmatter！\x1b[0m');
	}
}

main().catch(err => {
	console.error('\x1b[31m[Fatal Error]\x1b[0m', err);
	process.exit(1);
});
