import fs from 'fs';
import path from 'path';
import { XMLParser } from 'fast-xml-parser';
import {
	loadNewsThreads,
	filterAndRankItems,
	buildDailyPrompts,
	parseDailyJsonOutput,
	validateDailyJson,
	renderDailyMarkdown,
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
	const url = `https://api.github.com/repos/IGCIT/Intel-GPU-Community-Issue-Tracker-IGCIT/issues?since=${sinceStr}&per_page=15`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) return [];
		const issues = await res.json();
		if (!Array.isArray(issues)) return [];

		const results = [];
		for (const item of issues) {
			// 排除 PR
			if (item.pull_request) continue;

			const createdAt = new Date(item.created_at);
			const isNew = createdAt >= cutoffDate;

			// 如果是旧 issue（创建于 28 小时之前），若没有评论（comments === 0），说明仅为修改标签/分配人等元数据刷新，直接过滤
			if (!isNew && (!item.comments || item.comments === 0)) {
				continue;
			}

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
	const jsonValidation = validateDailyJson(parsedJson);
	if (!jsonValidation.isValid) {
		throw new Error(`模型输出的 JSON 结构校验未通过: ${jsonValidation.errors.join('; ')}`);
	}
	if (jsonValidation.warnings.length > 0) {
		console.warn('[daily-lib] JSON 数据规范告警:', jsonValidation.warnings.join('; '));
	}

	return parsedJson;
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

	const rawItems = await collectAllUpdates(history);
	if (rawItems.length === 0) {
		console.log('[Notice] 过去 28 小时内所有动态均已在往期日报中报道，今日无新增动态，跳过日报生成。');
		return;
	}

	const threads = loadNewsThreads();
	console.log(`[Threads] 载入了 ${threads.length} 个长期追踪技术事件。`);

	// 准入门槛提高至 15 分，精选 Top 20
	const items = filterAndRankItems(rawItems, threads, 15, 20);
	console.log(`[Rank] 经过技术重要性打分 (阈值: 15)，从 ${rawItems.length} 条中筛选出 ${items.length} 条真正高价值核心动态。`);

	if (items.length === 0) {
		console.log('[Notice] 今日经严苛打分后无达到门槛的高价值技术动态，遵循“宁缺毋滥”原则，跳过今日日报发布。');
		return;
	}

	// 1. 请求模型输出结构化 JSON
	const jsonData = await generateSummaryWithLLM(items, todayStr, history);

	// 2. 程序接管排版渲染 Markdown
	console.log('[3/4] 由程序模板引擎严格渲染 Markdown (强制 Frontmatter、受控 Badge 白名单与板块排版)...');
	const renderedMarkdown = renderDailyMarkdown(jsonData, todayStr, threads);

	// 3. 发布前硬门禁校验 (Pre-flight Hard Gate，写盘前拦截)
	console.log('[4/4] 正在执行发布前硬门禁校验 (Pre-flight Gate)...');
	const validation = validateDailyMarkdown(renderedMarkdown);
	if (!validation.isValid) {
		throw new Error(`发布前硬门禁校验失败，拒绝写入磁盘:\n - ${validation.errors.join('\n - ')}`);
	}
	console.log('\x1b[32m✔ 发布前硬门禁校验 100% 通过\x1b[0m');

	// 4. 最终落盘
	const outputFileName = `intel-gpu-daily-${todayStr}.md`;
	const newsDir = path.resolve('src/content/news');
	if (!fs.existsSync(newsDir)) {
		fs.mkdirSync(newsDir, { recursive: true });
	}
	const outputPath = path.join(newsDir, outputFileName);

	fs.writeFileSync(outputPath, renderedMarkdown, 'utf-8');
	console.log(`\x1b[32m✔ 成功生成并落盘日报文件: ${outputPath}\x1b[0m`);
}

main().catch(err => {
	console.error('\x1b[31m[Fatal Error]\x1b[0m', err);
	process.exit(1);
});
