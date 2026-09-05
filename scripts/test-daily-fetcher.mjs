import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
});

// 设置请求头（GitHub 和 Reddit 对没有 User-Agent 的请求会进行限流或拒绝）
const FETCH_HEADERS = {
	'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
	'Accept': 'application/xml, application/json, text/xml, */*',
};

// 如果有 GitHub Token，加上 Authorization 以提升 GitHub API 限流额度（每小时从 60 提升到 5000 次）
if (process.env.GITHUB_TOKEN) {
	FETCH_HEADERS['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
}

// 目标时间窗口：默认为过去 48 小时（周末跨天时可容纳更多更新）
const TIME_WINDOW_HOURS = 48;
const cutoffDate = new Date(Date.now() - TIME_WINDOW_HOURS * 60 * 60 * 1000);

console.log(`[Fetcher] 开始测试数据源采集，时间截止线: ${cutoffDate.toISOString()}`);

// 1. 抓取 GitHub Atom Releases
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
		if (!res.ok) {
			console.warn(`[Atom] ${repo} HTTP ${res.status}`);
			return [];
		}
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
		console.error(`[Atom] 抓取 ${repo} 异常:`, err.message);
		return [];
	}
}

// 2. 抓取 intel/llm-scaler 最近 Commits (特别关注针对 vllm/sglang/omni 的 patch)
async function fetchLlmScalerCommits() {
	const sinceStr = cutoffDate.toISOString();
	const url = `https://api.github.com/repos/intel/llm-scaler/commits?since=${sinceStr}&per_page=20`;
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) {
			console.warn(`[llm-scaler commits] HTTP ${res.status}`);
			return [];
		}
		const commits = await res.json();
		if (!Array.isArray(commits)) return [];
		return commits.map(c => ({
			source: 'intel/llm-scaler Commit',
			title: c.commit?.message?.split('\n')[0] || 'Untitled commit',
			author: c.commit?.author?.name,
			url: c.html_url,
			updated: c.commit?.author?.date,
			summary: c.commit?.message?.slice(0, 200),
		}));
	} catch (err) {
		console.error(`[llm-scaler commits] 抓取异常:`, err.message);
		return [];
	}
}

// 3. 抓取 GitHub Search API (PyTorch, vLLM, SGLang, llama.cpp, ComfyUI)
const SEARCH_QUERIES = [
	{
		label: 'PyTorch XPU',
		query: `repo:pytorch/pytorch is:pr is:merged label:"module: xpu" merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'vLLM upstream (XPU/Intel)',
		query: `repo:vllm-project/vllm is:pr is:merged xpu in:title merged:>=${cutoffDate.toISOString().split('T')[0]}`,
	},
	{
		label: 'llama.cpp (SYCL/OpenVINO)',
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
		if (!res.ok) {
			console.warn(`[GitHub Search] ${label} HTTP ${res.status}`);
			return [];
		}
		const data = await res.json();
		if (!data.items || !Array.isArray(data.items)) return [];

		return data.items.map(item => ({
			source: `Upstream PR: ${label}`,
			title: item.title,
			url: item.html_url,
			updated: item.closed_at || item.updated_at,
			summary: item.body ? item.body.replace(/<[^>]+>/g, '').slice(0, 300) : '',
		}));
	} catch (err) {
		console.error(`[GitHub Search] ${label} 异常:`, err.message);
		return [];
	}
}

// 4. 抓取 Phoronix RSS (过滤 Intel/Arc/Xe/ANV/oneAPI 等关键词)
async function fetchPhoronix() {
	const url = 'https://www.phoronix.com/rss.php';
	const keywords = ['intel', 'arc', 'xe', 'battlemage', 'panther lake', 'lunar lake', 'anv', 'i915', 'oneapi', 'level zero', 'xe2'];
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) {
			console.warn(`[Phoronix] HTTP ${res.status}`);
			return [];
		}
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
			const matched = keywords.some(k => titleLower.includes(k) || descLower.includes(k));

			if (matched) {
				results.push({
					source: 'Phoronix (Linux/Graphics)',
					title: item.title,
					url: item.link,
					updated: pubDate.toISOString(),
					summary: (item.description || '').replace(/<[^>]+>/g, '').slice(0, 300),
				});
			}
		}
		return results;
	} catch (err) {
		console.error('[Phoronix] 抓取异常:', err.message);
		return [];
	}
}

// 5. 抓取 Reddit r/IntelArc
async function fetchRedditArc() {
	const url = 'https://www.reddit.com/r/IntelArc/.rss';
	try {
		const res = await fetch(url, { headers: FETCH_HEADERS });
		if (!res.ok) {
			console.warn(`[Reddit] HTTP ${res.status}`);
			return [];
		}
		const xml = await res.text();
		const parsed = parser.parse(xml);
		const entries = parsed.feed?.entry;
		if (!entries) return [];

		const entryList = Array.isArray(entries) ? entries : [entries];
		const results = [];
		for (const e of entryList) {
			const updated = new Date(e.updated || e.published);
			if (updated < cutoffDate) continue;

			results.push({
				source: 'Reddit r/IntelArc',
				title: e.title,
				url: e.link?.['@_href'] || e.link,
				updated: updated.toISOString(),
				summary: typeof e.content === 'string' ? e.content.replace(/<[^>]+>/g, '').slice(0, 200) : '',
			});
		}
		return results;
	} catch (err) {
		console.error('[Reddit] 抓取异常:', err.message);
		return [];
	}
}

async function main() {
	console.log('--- 正在并发抓取信源 ---');
	const results = [];

	// 并行抓取 Atom Releases
	const atomPromises = ATOM_REPOS.map(fetchAtomReleases);
	const atomResults = await Promise.all(atomPromises);
	for (const r of atomResults) results.push(...r);

	// 抓取 llm-scaler commits
	const llmScalerCommits = await fetchLlmScalerCommits();
	results.push(...llmScalerCommits);

	// 抓取 Search PRs (加一点微小延时防止触发并发限制)
	for (const sq of SEARCH_QUERIES) {
		const prs = await fetchSearchPRs(sq.label, sq.query);
		results.push(...prs);
	}

	// 抓取 Phoronix
	const phoronixItems = await fetchPhoronix();
	results.push(...phoronixItems);

	// 抓取 Reddit
	const redditItems = await fetchRedditArc();
	results.push(...redditItems);

	console.log('\n=== 抓取统计结果 ===');
	console.log(`总条目数: ${results.length}`);
	results.forEach((item, idx) => {
		console.log(`[${idx + 1}] [${item.source}] ${item.title} (${item.updated})`);
		console.log(`    Link: ${item.url}`);
	});
}

main();
