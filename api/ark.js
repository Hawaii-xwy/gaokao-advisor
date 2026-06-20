// ════════════════════════════════════════════════════════════════
//  BytePlus 代理 —— Vercel 函数（放在仓库的 /api/ark.js）
//  路由：/api/ark?to=chat → BytePlus /api/v3/chat/completions
//        /api/ark?to=bot  → BytePlus /api/v3/bot/chat/completions
//  和网页同域 → 浏览器视为同源 → 没有跨域(CORS)问题。
//  Key 放在 Vercel 环境变量 ARK_API_KEY 里（Project → Settings → Environment Variables）。
//  ⚠️ 不要把 key 直接写进这个文件——如果你的 GitHub 仓库是公开的，会被人看到。
// ════════════════════════════════════════════════════════════════

export const config = { runtime: 'edge' };

// BytePlus 区域域名。默认亚太(柔佛)。如果你那个接入点在别的区域(比如 US 专属域名)，
// 从 BytePlus 控制台接入点的「API 调用示例」里把域名抄过来，替换这一行。
const ARK_ORIGIN = 'https://ark.ap-southeast.bytepluses.com';

const PATHS = {
  chat: '/api/v3/chat/completions',
  bot:  '/api/v3/bot/chat/completions',
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return new Response('Only POST', { status: 405 });

  const key = process.env.ARK_API_KEY;
  if (!key) {
    return json(500, { error: { message: '服务端未配置环境变量 ARK_API_KEY，去 Vercel 项目设置里添加后重新部署。' } });
  }

  const url = new URL(request.url);
  const to  = url.searchParams.get('to') || 'chat';
  const sub = PATHS[to] || PATHS.chat;
  const target = ARK_ORIGIN + sub;

  let body = '';
  try { body = await request.text(); } catch (_) {}

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
      },
      body,
    });
  } catch (e) {
    return json(502, { error: { message: '代理转发到 BytePlus 失败: ' + (e && e.message ? e.message : String(e)) } });
  }

  // 把上游响应（含 SSE 流式内容）原样透传回浏览器
  const headers = new Headers();
  const ct = upstream.headers.get('Content-Type');
  if (ct) headers.set('Content-Type', ct);
  return new Response(upstream.body, { status: upstream.status, headers });
}

