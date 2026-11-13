import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import {
	loadNewsThreads,
	filterAndRankItems,
	assignRefs,
	isIntelGpuRelated,
	extractDriverVersionKey,
	isValuableNewRepo,
	buildDailyPrompts,
	parseDailyJsonOutput,
	validateDailyJson,
	renderDailyMarkdown,
	renderQuietDayMarkdown,
	validateDailyMarkdown,
} from './daily-lib.mjs';

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

const DRY_RUN_COLLECT = process.argv.includes('--dry-run-collect');
const RADEON_API_KEY = process.env.RADEON_API_KEY;
const RADEON_BASE_URL = process.env.RADEON_BASE_URL || 'https://developer.amd.com.cn/radeon/api/v1';
const RADEON_MODEL = process.env.RADEON_MODEL || 'DeepSeek-V4-Flash';

if (!RADEON_API_KEY && !DRY_RUN_COLLECT) {
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

		// 提取历史日报中提及的 Windows Intel 驱动版本号（如 101.6632），防止多源跨天重复报道
		const driverMatches = content.matchAll(/\b(?:3[0-9]\.0\.)?(101\.\d{4,5})\b/g);
		for (const dm of driverMatches) {
			seenKeys.add(`driver:${dm[1]}`);
		}

		// 提取最新一期（即昨日）的核心速览部分
		if (i === 0) {
			const coreMatch = content.match(/## (?:核心速览|今日要点)([\s\S]*?)(?=\n## |$)/);
			if (coreMatch) {
				yesterdayHighlights = coreMatch[1].replace(/<[^>]+>/g, '').replace(/\[详情 →\]\([^)]*\)/g, '').trim();
			}
		}
	}

	return { seenUrls, seenKeys, yesterdayHighlights };
}

// --- 1. 抓取逻辑 ---

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function extractTextField(field) {
	if (!field) return '';
	if (typeof field === 'string') return field;
	if (typeof field === 'object') return field['#text'] || field['__cdata'] || '';
	return String(field);
}

// 1.1 GitHub Atom Releases
const ATOM_REPOS = [
	'intel/llm-scaler',
	'intel/intel-xpu-backend-for-triton',
	'vllm-project/vllm-xpu-kernels',
	'intel/compute-runtime',
	'intel/intel-graphics-compiler',
	'intel/llvm',
	'oneapi-src/oneDNN',
	'oneapi-src/oneMKL',
	'oneapi-src/level-zero',
	'uxlfoundation/oneCCL',
	'openvinotoolkit/openvino',
	'openvinotoolkit/openvino.genai',
	'huggingface/optimum-intel',
	'MistVVK/XeStrata',
	'IntelLabs/Xe-Forge',
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
				const rawContent = extractTextField(e.content);
				results.push({
					source: `GitHub Release: ${repo}`,
					title: extractTextField(e.title),
					url: e.link?.['@_href'] || e.link,
					updated: updated.toISOString(),
					summary: rawContent.replace(/<[^>]+>/g, '').slice(0, 300),
				});
			}
		}
		return results;
	} catch (err) {
		console.warn(`[Atom] ${repo} 抓取警告:`, err.message);
		return [];
	}
}

// 1.2 核心迭代仓库最新 Commits（底层内核与新兴高热引擎）
const COMMIT_REPOS = [
	'intel/llm-scaler',
	'intel/intel-xpu-backend-for-triton',
	'MistVVK/XeStrata',
	'IntelLabs/Xe-Forge',
];

async function fetchRepoCommits(repo) {
	const sinceStr = cutoffDate.toISOString();
	const url = `https://api.github.com/repos/${repo}/commits?since=${sinceStr}&per_page=20`;
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
				source: `${repo} (Commit/Patch)`,
				title: c.commit?.message?.split('\n')[0] || 'Untitled commit',
				url: c.html_url,
				updated: c.commit?.author?.date,
				summary: c.commit?.message?.slice(0, 250),
			}));
	} catch (err) {
		console.warn(`[${repo} commits] 抓取警告:`, err.message);
		return [];
	}
}

// 1.3 上游框架与底层算子库 PR
const dateCutoffStr = cutoffDate.toISOString().split('T')[0];
const SEARCH_QUERIES = [
	{
		label: 'PyTorch (torch.xpu)',
		query: `repo:pytorch/pytorch is:pr is:merged label:"module: xpu" merged:>=${dateCutoffStr}`,
	},
	{
		label: 'intel/torch-xpu-ops',
		query: `repo:intel/torch-xpu-ops is:pr is:merged merged:>=${dateCutoffStr}`,
	},
	{
		label: 'vLLM (upstream XPU)',
		query: `repo:vllm-project/vllm is:pr is:merged (xpu OR "intel gpu") in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'vllm-xpu-kernels',
		query: `repo:vllm-project/vllm-xpu-kernels is:pr is:merged merged:>=${dateCutoffStr}`,
	},
	{
		label: 'llama.cpp (sycl/openvino/intel)',
		query: `repo:ggml-org/llama.cpp is:pr is:merged (sycl OR openvino OR "intel gpu") in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'SGLang (XPU)',
		query: `repo:sgl-project/sglang is:pr is:merged (xpu OR "intel gpu") in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'ComfyUI (Intel/XPU)',
		query: `repo:comfyanonymous/ComfyUI is:pr is:merged (xpu OR intel) in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'Ollama (SYCL/Intel)',
		query: `repo:ollama/ollama is:pr is:merged (sycl OR intel OR oneapi) in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'DeepSpeed (XPU)',
		query: `repo:microsoft/DeepSpeed is:pr is:merged xpu in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'Transformers (XPU)',
		query: `repo:huggingface/transformers is:pr is:merged (xpu OR "intel gpu") in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'bitsandbytes (XPU)',
		query: `repo:bitsandbytes-foundation/bitsandbytes is:pr is:merged (xpu OR intel) in:title merged:>=${dateCutoffStr}`,
	},
	{
		label: 'Strata (XPU/SYCL)',
		query: `repo:Niko1221/Strata is:pr is:merged (xpu OR sycl OR intel OR "level zero") merged:>=${dateCutoffStr}`,
	},
];

async function fetchSearchPRs(label, query) {
	const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=updated&order=desc&per_page=10`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) {
			console.warn(`[GitHub Search] ${label} HTTP ${res.status}`);
			return [];
		}
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
			if (excludeKeywords.some(ex => titleLower.includes(ex))) continue;

			const desc = extractTextField(item.description);
			if (isIntelGpuRelated(`${item.title || ''} ${desc}`)) {
				results.push({
					source: 'Phoronix (Linux Graphics/Driver)',
					title: item.title,
					url: item.link,
					updated: pubDate.toISOString(),
					summary: desc.replace(/<[^>]+>/g, '').slice(0, 250),
				});
			}
		}
		return results;
	} catch (err) {
		console.warn('[Phoronix] 抓取警告:', err.message);
		return [];
	}
}

// 1.5 Windows Intel 显卡驱动双源交叉监控 (TechPowerUp / Guru3D)
const DRIVER_MEDIA_FEEDS = [
	{ name: 'TechPowerUp (Windows 驱动与硬件)', url: 'https://www.techpowerup.com/rss/news' },
	{ name: 'Guru3D (Windows 驱动与硬件)', url: 'https://www.guru3d.com/rss.xml' },
];

async function fetchDriverNewsFeed(sourceName, url) {
	const intelTitleRe = /\b(intel|arc|battlemage|alchemist|xess)\b/i;
	const driverRe = /\b(drivers?|whql|game on|game ready|graphics|101\.\d{4}|xess)\b/i;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const xml = await res.text();
		const parsed = parser.parse(xml);
		const rawItems = parsed.rss?.channel?.item || parsed.feed?.entry;
		if (!rawItems) return [];

		const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];
		const results = [];
		for (const item of itemList) {
			const pubDate = new Date(item.pubDate || item.published || item.updated);
			if (Number.isNaN(pubDate.getTime()) || pubDate < cutoffDate) continue;

			const title = extractTextField(item.title);
			const desc = extractTextField(item.description || item.content || item.summary);
			const fullText = `${title} ${desc}`;

			if (intelTitleRe.test(title) && driverRe.test(fullText)) {
				const link = typeof item.link === 'string' ? item.link : (item.link?.['@_href'] || '');
				results.push({
					source: sourceName,
					title,
					url: link,
					updated: pubDate.toISOString(),
					summary: desc.replace(/<[^>]+>/g, '').slice(0, 300),
				});
			}
		}
		return results;
	} catch (err) {
		console.warn(`[${sourceName}] 抓取警告:`, err.message);
		return [];
	}
}

// 1.6 Intel GPU Community Issue Tracker (IGCIT)
async function fetchIGCITIssues() {
	const sinceStr = cutoffDate.toISOString();
	const url = `https://api.github.com/repos/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues?since=${sinceStr}&per_page=15`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const issues = await res.json();
		if (!Array.isArray(issues)) return [];

		const results = [];
		for (const item of issues) {
			if (item.pull_request) continue;
			const createdAt = new Date(item.created_at);
			const isNew = createdAt >= cutoffDate;
			if (!isNew && (!item.comments || item.comments === 0)) continue;

			results.push({
				source: isNew ? 'Intel 官方社区驱动追踪 (新提交 Issue)' : 'Intel 官方社区驱动追踪 (Issue 进展更新)',
				title: item.title,
				url: item.html_url,
				updated: item.updated_at,
				created_at: item.created_at,
				issueType: isNew ? 'new' : 'old',
				summary: item.body ? item.body.replace(/<[^>]+>/g, '').slice(0, 250) : '',
			});
		}
		return results;
	} catch (err) {
		console.warn('[IGCIT] 抓取警告:', err.message);
		return [];
	}
}

// 1.8 Reddit r/IntelArc 与 r/LocalLLaMA
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

			const title = extractTextField(e.title);
			const titleLower = title.toLowerCase();
			const matched = valuableKeywords.some(k => titleLower.includes(k));
			if (!matched || titleLower.startsWith('help') || titleLower.startsWith('can’t play') || titleLower.includes('is a 500wat')) continue;

			results.push({
				source: 'Reddit r/IntelArc (社区实测与讨论)',
				title,
				url: e.link?.['@_href'] || e.link,
				updated: updated.toISOString(),
				summary: extractTextField(e.content).replace(/<[^>]+>/g, '').slice(0, 200),
			});
		}
		return results;
	} catch (err) {
		console.warn('[Reddit r/IntelArc] 抓取警告:', err.message);
		return [];
	}
}

async function fetchRedditLocalLLaMA() {
	const url = 'https://www.reddit.com/r/LocalLLaMA/.rss';
	const titleFilterRe = /\b(intel\s*arc|intel\s*gpu|xpu|sycl|openvino|b580|b60|b70|a770|battlemage|xestrata|llm-scaler)\b/i;
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

			const title = extractTextField(e.title);
			const contentText = extractTextField(e.content).replace(/<[^>]+>/g, '');
			if (!titleFilterRe.test(`${title} ${contentText.slice(0, 300)}`)) continue;

			results.push({
				source: 'Reddit r/LocalLLaMA (社区推理生态)',
				title,
				url: e.link?.['@_href'] || e.link,
				updated: updated.toISOString(),
				summary: contentText.slice(0, 220),
			});
		}
		return results;
	} catch (err) {
		console.warn('[Reddit r/LocalLLaMA] 抓取警告:', err.message);
		return [];
	}
}

// 1.9 主动生态雷达：GitHub 新兴项目发现 + Hacker News
const DISCOVERED_REPOS_PATH = path.resolve('src/data/discovered-repos.json');

function loadDiscoveredRepos() {
	if (!fs.existsSync(DISCOVERED_REPOS_PATH)) return {};
	try {
		return JSON.parse(fs.readFileSync(DISCOVERED_REPOS_PATH, 'utf-8'));
	} catch {
		return {};
	}
}

function saveDiscoveredRepos(map) {
	fs.mkdirSync(path.dirname(DISCOVERED_REPOS_PATH), { recursive: true });
	fs.writeFileSync(DISCOVERED_REPOS_PATH, JSON.stringify(map, null, 2) + '\n', 'utf-8');
}

const KNOWN_REPOS = new Set([
	...ATOM_REPOS.map(r => r.toLowerCase()),
	...COMMIT_REPOS.map(r => r.toLowerCase()),
	'pytorch/pytorch',
	'vllm-project/vllm',
	'ggml-org/llama.cpp',
	'ggerganov/llama.cpp',
	'sgl-project/sglang',
	'comfyanonymous/comfyui',
	'ollama/ollama',
	'microsoft/deepspeed',
	'huggingface/transformers',
	'bitsandbytes-foundation/bitsandbytes',
	'niko1221/strata',
	'igcit/intel-gpu-community-issue-tracker-igcit',
	'intel/ipex-llm',
	'intel/intel-extension-for-pytorch',
]);

async function fetchDiscoveredRepos(discoveredHistory) {
	const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	const queries = [
		// 1. 近期两周内新建且快速获星的新项目（最容易捕捉 XeStrata 这类新黑马）
		`("intel arc" OR "intel gpu" OR "intel xpu" OR "sycl" OR "battlemage" OR "level zero") created:>=${twoWeeksAgo} stars:>=15`,
		// 2. 全网过去 28 小时有推送且包含 Intel GPU/XPU 关键特征的高星活跃项目（捕捉新接入 Intel 支持的热门库）
		`("intel arc" OR "intel xpu" OR "intel gpu" OR "sycl" OR "battlemage") pushed:>=${dateCutoffStr} stars:>=30`,
	];

	const candidateRepos = new Map();
	for (const q of queries) {
		const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=15`;
		try {
			const res = await fetch(url, { headers: FETCH_HEADERS });
			if (!res.ok) {
				console.warn(`[Discovery Radar] GitHub Repo 搜索 HTTP ${res.status}`);
				continue;
			}
			const data = await res.json();
			for (const repo of data.items || []) {
				if (!candidateRepos.has(repo.full_name.toLowerCase())) {
					candidateRepos.set(repo.full_name.toLowerCase(), repo);
				}
			}
		} catch (err) {
			console.warn('[Discovery Radar] GitHub Repo 搜索警告:', err.message);
		}
		await sleep(350);
	}

	const results = [];
	for (const repo of candidateRepos.values()) {
		if (!isValuableNewRepo(repo, KNOWN_REPOS, discoveredHistory)) continue;
		const isMilestone = Boolean(discoveredHistory[repo.full_name.toLowerCase()]);
		results.push({
			source: '开源新项目雷达 (GitHub Discovery)',
			title: `${isMilestone ? '[热度跃迁] ' : ''}${repo.full_name} (⭐ ${repo.stargazers_count})`,
			url: repo.html_url,
			updated: repo.pushed_at || repo.updated_at,
			stars: repo.stargazers_count,
			repoFullName: repo.full_name,
			summary: `语言: ${repo.language || 'Unknown'} | Stars: ${repo.stargazers_count} | Topics: ${(repo.topics || []).join(', ') || '无'} | 简介: ${repo.description}`,
		});
	}
	return results;
}

async function fetchHackerNews() {
	const cutoffEpoch = Math.floor(cutoffDate.getTime() / 1000);
	const queries = ['"intel arc"', '"intel gpu"', '"xpu"'];
	const seenIds = new Set();
	const results = [];

	for (const q of queries) {
		const url = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(q)}&tags=story&numericFilters=created_at_i>${cutoffEpoch},points>=10`;
		try {
			const res = await fetch(url);
			if (!res.ok) continue;
			const data = await res.json();
			for (const hit of data.hits || []) {
				if (seenIds.has(hit.objectID)) continue;
				seenIds.add(hit.objectID);

				const title = hit.title || '';
				const storyUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
				if (!isIntelGpuRelated(title)) continue;

				results.push({
					source: 'Hacker News (社区热点讨论)',
					title: `${title} (${hit.points} pts, ${hit.num_comments || 0} comments)`,
					url: storyUrl,
					updated: hit.created_at,
					summary: `HN 讨论地址: https://news.ycombinator.com/item?id=${hit.objectID} | 热度: ${hit.points} 分 / ${hit.num_comments || 0} 评论`,
				});
			}
		} catch (err) {
			console.warn('[Hacker News] 抓取警告:', err.message);
		}
	}
	return results;
}

// --- 2. 汇总与组装 ---
async function collectAllUpdates(history, discoveredHistory) {
	console.log('[1/4] 正在并发采集 Intel GPU 生态动态（含多源驱动与新项目雷达）...');
	const rawItems = [];

	const [
		atoms,
		repoCommits,
		phoronix,
		driverMedia,
		igcit,
		redditArc,
		redditLlama,
		hnItems,
	] = await Promise.all([
		Promise.all(ATOM_REPOS.map(fetchAtomReleases)),
		Promise.all(COMMIT_REPOS.map(fetchRepoCommits)),
		fetchPhoronix(),
		Promise.all(DRIVER_MEDIA_FEEDS.map(f => fetchDriverNewsFeed(f.name, f.url))),
		fetchIGCITIssues(),
		fetchRedditArc(),
		fetchRedditLocalLLaMA(),
		fetchHackerNews(),
	]);

	for (const a of atoms) rawItems.push(...a);
	for (const c of repoCommits) rawItems.push(...c);
	rawItems.push(...phoronix);
	for (const d of driverMedia) rawItems.push(...d);
	rawItems.push(...igcit);
	rawItems.push(...redditArc);
	rawItems.push(...redditLlama);
	rawItems.push(...hnItems);

	// GitHub Search（PR 与 新项目雷达）带轻微间隔串行执行，避免触发 Secondary Rate Limit
	for (const sq of SEARCH_QUERIES) {
		const prs = await fetchSearchPRs(sq.label, sq.query);
		rawItems.push(...prs);
		await sleep(350);
	}

	const discoveredRepos = await fetchDiscoveredRepos(discoveredHistory);
	rawItems.push(...discoveredRepos);

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

		// 2. 检查 PR/Issue 编号是否已被收录
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

		// 4. 检查 Windows 驱动版本号是否已在往期报道过
		const drvKey = extractDriverVersionKey(`${item.title || ''} ${item.summary || ''}`);
		if (drvKey && history.seenKeys.has(drvKey)) {
			skippedHistoryCount++;
			continue;
		}

		// 5. 本次采集内部去重
		if (!seenUrls.has(cleanUrl)) {
			seenUrls.add(cleanUrl);
			deduplicated.push(item);
		}
	}

	console.log(`[1/4] 采集完成: 原始抓取 ${rawItems.length} 条，过滤历史已报道 ${skippedHistoryCount} 条，最终清洗出 ${deduplicated.length} 条今日新增动态。`);
	return deduplicated;
}

// --- 3. 调用 Radeon Cloud LLM 生成结构化 JSON ---
async function generateSummaryWithLLM(items, todayStr, history) {
	console.log(`[2/4] 调用 Radeon Cloud API (${RADEON_MODEL}) 提取高信息密度结构化研报数据 (JSON 模式)...`);

	const { systemPrompt, userPrompt } = buildDailyPrompts(items, todayStr, history);

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
					response_format: { type: 'json_object' },
					temperature: 0.2, // 保持低温度以确保严谨无幻觉
					max_tokens: 4500,
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

	const parsedJson = parseDailyJsonOutput(content);
	const jsonValidation = validateDailyJson(parsedJson, items);
	if (!jsonValidation.isValid) {
		throw new Error(`模型输出的 JSON 结构校验未通过: ${jsonValidation.errors.join('; ')}`);
	}
	if (jsonValidation.warnings.length > 0) {
		console.warn('[daily-lib] JSON 数据规范告警:', jsonValidation.warnings.join('; '));
	}

	return jsonValidation.data;
}

function writeOutputs(todayStr, markdown, snapshot) {
	const newsDir = path.resolve('src/content/news');
	fs.mkdirSync(newsDir, { recursive: true });
	const outputPath = path.join(newsDir, `intel-gpu-daily-${todayStr}.md`);
	fs.writeFileSync(outputPath, markdown, 'utf-8');
	console.log(`\x1b[32m✔ 日报已写入: ${outputPath}\x1b[0m`);

	if (snapshot) {
		const jsonDir = path.resolve('src/data/news-json');
		fs.mkdirSync(jsonDir, { recursive: true });
		const jsonPath = path.join(jsonDir, `${todayStr}.json`);
		fs.writeFileSync(jsonPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf-8');
		console.log(`✔ 结构化数据已保存: ${jsonPath}`);
	}
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

	const discoveredHistory = loadDiscoveredRepos();
	const rawItems = await collectAllUpdates(history, discoveredHistory);
	const threads = loadNewsThreads();
	console.log(`[Threads] 载入了 ${threads.length} 个长期追踪技术事件。`);

	const items = assignRefs(filterAndRankItems(rawItems, threads, 15, 22));
	console.log(`[Rank] 阈值 15：${rawItems.length} 条候选中保留 ${items.length} 条。`);

	if (DRY_RUN_COLLECT) {
		console.log('\n[Dry-Run] 保留的候选条目详情:');
		for (const it of items) {
			console.log(`  [${it.ref}] (score=${it.score}) [${it.source}] ${it.title} -> ${it.url}`);
		}
		return;
	}

	if (items.length === 0) {
		console.log('[Notice] 今日没有达到门槛的动态，发布简报。');
		writeOutputs(todayStr, renderQuietDayMarkdown(todayStr, rawItems.length), null);
		return;
	}

	// 1. 模型输出结构化 JSON（仅理解与提炼）
	const jsonData = await generateSummaryWithLLM(items, todayStr, history);

	// 2. 程序渲染：板块、模块分组、主次分级、链接均由代码决定
	console.log('[3/4] 渲染 Markdown...');
	const renderedMarkdown = renderDailyMarkdown(jsonData, todayStr, threads, items);

	// 3. 发布前硬门禁
	console.log('[4/4] 发布前校验...');
	const validation = validateDailyMarkdown(renderedMarkdown);
	if (!validation.isValid) {
		throw new Error(`发布前校验失败，拒绝写入磁盘:\n - ${validation.errors.join('\n - ')}`);
	}

	writeOutputs(todayStr, renderedMarkdown, {
		date: todayStr,
		sources: items.map(({ ref, source, title, url, updated, score }) => ({ ref, source, title, url, updated, score })),
		output: jsonData,
	});

	// 4. 仅在成功发布后记录本次入选的新项目，避免刷屏重复报道
	const usedRefs = new Set((jsonData.items || []).flatMap(it => it.refs || []));
	let discoveredUpdated = false;
	for (const it of items) {
		if (it.repoFullName && usedRefs.has(it.ref)) {
			discoveredHistory[it.repoFullName.toLowerCase()] = {
				fullName: it.repoFullName,
				stars: it.stars || 0,
				lastReported: todayStr,
			};
			discoveredUpdated = true;
		}
	}
	if (discoveredUpdated) {
		saveDiscoveredRepos(discoveredHistory);
		console.log(`✔ 新项目雷达记录已更新: ${DISCOVERED_REPOS_PATH}`);
	}
}

main().catch(err => {
	console.error('\x1b[31m[Fatal Error]\x1b[0m', err);
	process.exit(1);
});
