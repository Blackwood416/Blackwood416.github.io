export default {
  // Cloudflare Cron 定时事件处理函数（由 Cloudflare 全球边缘网络定时调度）
  async scheduled(event, env, ctx) {
    console.log(`[Cron Trigger] Triggered at ${new Date().toISOString()}`);
    const result = await triggerGitHubWorkflow(env);
    console.log('[Cron Result]', JSON.stringify(result));
  },

  // HTTP GET 请求处理函数（可用于健康检查或手动测试触发）
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 健康检查
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', now: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 手动立即触发 GitHub Actions
    if (url.pathname === '/trigger' || url.pathname === '/') {
      const result = await triggerGitHubWorkflow(env);
      return new Response(JSON.stringify(result, null, 2), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

async function triggerGitHubWorkflow(env) {
  const token = env.GH_PAT;
  if (!token) {
    return {
      success: false,
      error: 'Missing GH_PAT environment secret in Cloudflare Worker',
      timestamp: new Date().toISOString(),
    };
  }

  const repoOwner = env.REPO_OWNER || 'Blackwood416';
  const repoName = env.REPO_NAME || 'Blackwood416.github.io';
  const workflowId = env.WORKFLOW_ID || 'daily-intel-gpu.yml';
  const branch = env.BRANCH || 'master';

  const targetUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/${workflowId}/dispatches`;

  try {
    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Cloudflare-Worker-Cron-Trigger',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        ref: branch,
      }),
    });

    if (res.status === 204) {
      return {
        success: true,
        message: `Successfully triggered GitHub workflow '${workflowId}' on ${repoOwner}/${repoName} (${branch})`,
        timestamp: new Date().toISOString(),
      };
    } else {
      const errText = await res.text();
      return {
        success: false,
        status: res.status,
        error: errText,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
    };
  }
}
