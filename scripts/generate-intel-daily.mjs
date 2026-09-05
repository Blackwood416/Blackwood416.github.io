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

// 时间窗口：默认拉取过去 48 小时
const TIME_WINDOW_HOURS = 48;
const cutoffDate = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);

// --- 1. 抓取逻辑 ---

// 1.1 GitHub Atom Releases
const ATOM_REPOS = [
	'intel/llm-scaler',
	'intel/compute-runtime',
	'intel/intel-graphics-compiler',
	'intel/llvm',
	'oneapi-src/oneDNN',
	'openvinotoolkit/openvino',
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

// 1.2 intel/llm-scaler 最新 Commits
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

// 1.3 上游框架 PR
const SEARCH_QUERIES = [
	{
		label: 'PyTorch (torch.xpu)',
		query: `repo:pytorch/pytorch is:pr is:merged label:"module: xpu" merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'vLLM (upstream)',
		query: `repo:vllm-project/vllm is:pr is:merged xpu in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'llama.cpp (sycl/openvino)',
		query: `repo:ggerganov/llama.cpp is:pr is:merged sycl in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'SGLang (XPU)',
		query: `repo:sgl-project/sglang is:pr is:merged xpu in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'ComfyUI (Intel/XPU)',
		query: `repo:comfyanonymous/ComfyUI is:pr is:merged xpu in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
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
async function collectAllUpdates() {
	console.log('[1/4] 正在并发采集 Intel GPU 生态动态...');
	const rawItems = [];

	const [atoms, commits, phoronix, reddit] = await Promise.all([
		Promise.all(ATOM_REPOS.map(fetchAtomReleases)),
		fetchLlmScalerCommits(),
		fetchPhoronix(),
		fetchRedditArc(),
	]);

	for (const a of atoms) rawItems.push(...a);
	rawItems.push(...commits);
	rawItems.push(...phoronix);
	rawItems.push(...reddit);

	// 上游 PR 逐个执行（微小间隔防 403）
	for (const sq of SEARCH_QUERIES) {
		const prs = await fetchSearchPRs(sq.label, sq.query);
		rawItems.push(...prs);
	}

	// 按 URL 去重
	const seenUrls = new Set();
	const deduplicated = [];
	for (const item of rawItems) {
		if (item.url && !seenUrls.has(item.url)) {
			seenUrls.add(item.url);
			deduplicated.push(item);
		}
	}

	console.log(`[1/4] 采集完成，共清洗出 ${deduplicated.length} 条有效信源条目。`);
	return deduplicated;
}

// --- 3. 调用 Radeon Cloud LLM 生成 Markdown ---
async function generateSummaryWithLLM(items, todayStr) {
	console.log(`[2/4] 调用 Radeon Cloud API (${RADEON_MODEL}) 进行高信息密度技术提炼...`);

	const promptData = items.map((it, idx) => `[${idx + 1}] 来源: ${it.source}
标题: ${it.title}
链接: ${it.url}
时间: ${it.updated}
摘要: ${it.summary.replace(/\s+/g, ' ')}
---`).join('\n');

	const systemPrompt = `你是一名精通底层系统编程、GPU 架构与深度学习编译器的工程师，深度关注 Intel GPU（Arc 独显如 Battlemage/Alchemist、核显如 Lunar Lake/Arrow Lake、数据中心 GPU）及其 AI 软件栈（oneAPI、SYCL、XPU、oneDNN、OpenVINO、vLLM、SGLang、ComfyUI、llama.cpp、Linux drm/xe 驱动）。

你的任务：根据提供的过去 24~48 小时内的信源列表，撰写一篇专业、严谨、低“AI味”的《Intel GPU 技术生态日报》。

【语言纪律与反“AI味”原则 - 严格执行】
1. 严禁使用任何宣传公关套话（如“重磅来袭”、“里程碑”、“颠覆性”、“赋予新生命”、“赋能”等）。
2. 严禁使用“不是……而是……”、“不仅如此……”、“总的来说……”、“正如大家所知……”等机械说教句式。
3. 严禁任何文学比喻，禁止进行虚浮的升华总结或主观抒情。
4. 客观陈述技术事实：讲清楚做了什么具体改动（算子优化、寄存器分配、死锁修复、指令集拓展等）、适配的具体架构代号（如 BMG、LNL、ARL、PTL、PVC 等）、实测基准数据，保留精确术语（如 ESIMD, Subgroup, XMX, Level Zero, SYCL, USM, DP, MTP, KV Cache, drm/xe, ANV）。
5. 条目格式必须紧凑：
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

正文必须使用清晰的二级标题组织（以触发博客右侧 TOC 目录导航）：
## 核心速览
(用 2~3 条极为简炼的要点概括当日最关键的技术变动)

## 下游优化与加速库 (intel/llm-scaler)
(重点分析 intel/llm-scaler 专为 Intel GPU 提交的 patch，包括 vLLM/SGLang/Omni 中的 ESIMD 算子、INT4/FP8 支持、调度优化)

## 主流框架与上游集成 (PyTorch / vLLM / SGLang / llama.cpp)
(分析合并至官方上游的 XPU / SYCL PR，说明具体修改模块与效果)

## 驱动、内核与图形栈 (Linux drm/xe / Mesa ANV)
(分析内核驱动改进、Mesa Vulkan 进展等)

## 社区实测与生态动态
(精选社区内有技术价值的基准测试、工具更新或驱动调优经验)

【注意】
若某个版块完全没有对应信源更新，请保持极客原则直接忽略该二级标题，切勿无中生有编造虚假内容！`;

	const userPrompt = `以下是今日收集到的原始信源列表，请严格按照上述要求提炼并生成完整 Markdown：\n\n${promptData}`;

	const response = await fetch(`${RADEON_BASE_URL}/chat/completions`, {
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

// 清理 Markdown 代码块外框（有些 LLM 喜欢在整个输出外套一层 ```markdown ... ```）
function sanitizeMarkdown(text) {
	let cleaned = text.trim();
	if (cleaned.startsWith('```markdown')) {
		cleaned = cleaned.replace(/^```markdown\r?\n/, '');
		cleaned = cleaned.replace(/\r?\n```$/, '');
	} else if (cleaned.startsWith('```')) {
		cleaned = cleaned.replace(/^```\r?\n/, '');
		cleaned = cleaned.replace(/\r?\n```$/, '');
	}
	return cleaned.trim();
}

// --- 4. 主流程执行 ---
async function main() {
	const today = new Date();
	const yyyy = today.getFullYear();
	const mm = String(today.getMonth() + 1).padStart(2, '0');
	const dd = String(today.getDate()).padStart(2, '0');
	const todayStr = `${yyyy}-${mm}-${dd}`;

	const items = await collectAllUpdates();
	if (items.length === 0) {
		console.log('[Notice] 过去 48 小时内没有检测到新的 Intel GPU 动态，跳过日报生成。');
		return;
	}

	const generatedContent = await generateSummaryWithLLM(items, todayStr);
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
