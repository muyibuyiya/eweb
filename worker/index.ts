import {
  parseGalleryDetailHtml,
  parseGalleryListHtml,
  parseReaderPageHtml,
} from '../server/ehParser.js';
import {
  getDemoGalleryDetail,
  getDemoGalleryList,
  getDemoReaderPage,
  renderDemoSvg,
} from '../server/demoData.js';
import {
  pixivAddBookmark,
  pixivFetchDetail,
  pixivFetchList,
} from '../server/providers/pixiv.js';
import {
  DEFAULT_JM_DOMAIN,
  jmFetchChapterPreviews,
  jmFetchDetail,
  jmFetchList,
} from '../server/providers/jmcomic.js';
import { ehAddFavorite } from '../server/providers/ehFavorite.js';
import type { EhSite } from '../shared/types.js';

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface WorkerContext {
  site: EhSite;
  cookie?: string;
  pixivCookie?: string;
  jmCookie?: string;
  jmDomain?: string;
}

const VALID_SITES = new Set<EhSite>(['e-hentai', 'exhentai', 'pixiv', 'jmcomic']);

function parseSite(raw?: string | null): EhSite {
  if (raw && VALID_SITES.has(raw as EhSite)) return raw as EhSite;
  return 'e-hentai';
}

const ALLOWED_IMAGE_HOST_PATTERNS = [
  /(^|\.)e-hentai\.org$/i,
  /(^|\.)exhentai\.org$/i,
  /(^|\.)ehgt\.org$/i,
  /(^|\.)hath\.network$/i,
  /(^|\.)pximg\.net$/i,
  /(^|\.)pixiv\.net$/i,
  /(^|\.)18comic\./i,
  /(^|\.)jmcomic/i,
  /(^|\.)cdn-msp/i,
  /(^|\.)jmapiproxy/i,
  /(^|\.)cdnblackmyth\./i,
  /(^|\.)cdnmhwscc\./i,
  /(^|\.)cdnuc\./i,
];

function isAllowedImageUrl(rawUrl: string, jmDomain?: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    if (ALLOWED_IMAGE_HOST_PATTERNS.some((p) => p.test(parsed.hostname))) return true;
    if (jmDomain) {
      try {
        const jmHost = new URL(jmDomain).hostname.replace(/^www\./, '');
        if (parsed.hostname === jmHost || parsed.hostname.endsWith(`.${jmHost}`)) return true;
      } catch {
        // ignore invalid custom domain
      }
    }
    return false;
  } catch {
    return false;
  }
}

function getSiteBaseUrl(site: EhSite): string {
  return site === 'exhentai' ? 'https://exhentai.org' : 'https://e-hentai.org';
}

function buildCookieHeader(rawCookie?: string): string {
  const parts = new Map<string, string>();
  parts.set('nw', '1');
  if (rawCookie) {
    for (const seg of rawCookie.split(';')) {
      const idx = seg.indexOf('=');
      if (idx > 0) {
        const k = seg.slice(0, idx).trim();
        const v = seg.slice(idx + 1).trim();
        if (k && v) parts.set(k, v);
      }
    }
  }
  return Array.from(parts.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

function parseSessionCookie(request: Request): WorkerContext | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/(?:^|;\s*)ehweb_cfg=([^;]+)/);
  if (!match) return null;
  try {
    const json = atob(decodeURIComponent(match[1]));
    const parsed = JSON.parse(json) as Partial<WorkerContext>;
    return {
      site: parseSite(parsed.site),
      cookie: typeof parsed.cookie === 'string' ? parsed.cookie : undefined,
      pixivCookie: typeof parsed.pixivCookie === 'string' ? parsed.pixivCookie : undefined,
      jmCookie: typeof parsed.jmCookie === 'string' ? parsed.jmCookie : undefined,
      jmDomain: typeof parsed.jmDomain === 'string' ? parsed.jmDomain : undefined,
    };
  } catch {
    return null;
  }
}

function getContext(request: Request): WorkerContext {
  const fromCookie = parseSessionCookie(request);
  const url = new URL(request.url);
  const rawSite =
    request.headers.get('x-eh-site') || url.searchParams.get('site') || fromCookie?.site;

  return {
    site: parseSite(rawSite),
    cookie: request.headers.get('x-eh-cookie') || fromCookie?.cookie || undefined,
    pixivCookie: request.headers.get('x-pixiv-cookie') || fromCookie?.pixivCookie || undefined,
    jmCookie: request.headers.get('x-jm-cookie') || fromCookie?.jmCookie || undefined,
    jmDomain: request.headers.get('x-jm-domain') || fromCookie?.jmDomain || DEFAULT_JM_DOMAIN,
  };
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, x-eh-site, x-eh-cookie, x-pixiv-cookie, x-jm-cookie, x-jm-domain, x-eh-proxy, x-eh-sid',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function jsonResponse(
  request: Request,
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

async function fetchEhHtml(url: string, ctx: WorkerContext): Promise<string> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      Cookie: buildCookieHeader(ctx.cookie),
      Referer: getSiteBaseUrl(ctx.site) + '/',
    },
    redirect: 'follow',
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    throw new Error(
      'ExHentai 返回了 Sad Panda（无访问权限）。请在设置中检查 Cookie，或切换回 E-Hentai 表站。'
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`上游站点返回 HTTP ${res.status}`);
  }
  if (!text.trim()) {
    throw new Error('上游站点返回了空白页面（可能是 Cookie 失效或 Cloudflare 节点 IP 被限流）。');
  }
  if (
    text.includes('Your IP address has been temporarily banned') ||
    text.includes('temporarily banned')
  ) {
    throw new Error(
      '当前 Cloudflare 公共出口 IP 已被 E-Hentai 临时限流。导入你的 E-Hentai 登录 Cookie 通常可缓解，或稍等片刻再试 / 改用本机 Node 服务。'
    );
  }
  if (text.includes('You are opening pages too fast')) {
    throw new Error('请求频率过快，请稍等几秒后刷新重试。');
  }
  return text;
}

function assertValidGalleryListHtml(html: string, parsedCount: number, site: EhSite): void {
  if (parsedCount > 0) return;
  if (
    html.includes('No unfiltered results') ||
    html.includes('No hits found') ||
    html.includes('found 0 results')
  ) {
    return;
  }
  const plain = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  throw new Error(
    `上游 ${site} 未返回画廊列表（可能是 Cloudflare 公共 IP 临时受限或需要登录 Cookie）。站点提示：${plain || '空页面'}`
  );
}

interface EhTagDbRaw {
  head?: { sha?: string };
  data?: Array<{
    namespace: string;
    data: Record<string, { name?: string }>;
  }>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === 'OPTIONS' && pathname.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (!pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }

    try {
      if (pathname === '/api/health') {
        return jsonResponse(request, {
          ok: true,
          port: 443,
          lanUrls: [url.origin],
          envProxyConfigured: false,
          runtime: 'cloudflare-workers',
        });
      }

      if (pathname === '/api/session' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as Partial<WorkerContext>;
        const payload = btoa(
          JSON.stringify({
            site: parseSite(body.site),
            cookie: typeof body.cookie === 'string' ? body.cookie : '',
            pixivCookie: typeof body.pixivCookie === 'string' ? body.pixivCookie : '',
            jmCookie: typeof body.jmCookie === 'string' ? body.jmCookie : '',
            jmDomain: typeof body.jmDomain === 'string' ? body.jmDomain : DEFAULT_JM_DOMAIN,
          })
        );
        const cookieFlags = `ehweb_cfg=${encodeURIComponent(payload)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=2592000${
          url.protocol === 'https:' ? '; Secure' : ''
        }`;
        return jsonResponse(request, { sid: 'cf-cookie' }, 200, {
          'Set-Cookie': cookieFlags,
        });
      }

      // Official E-Hentai forum login endpoint
      if (pathname === '/api/eh-login' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          username?: string;
          password?: string;
        };
        if (!body.username?.trim() || !body.password) {
          return jsonResponse(request, { error: '请输入 E-Hentai 用户名和密码' }, 400);
        }

        const form = new URLSearchParams({
          referer: 'https://forums.e-hentai.org/index.php?',
          b: '',
          bt: '',
          UserName: body.username.trim(),
          PassWord: body.password,
          CookieDate: '1',
        });

        const loginRes = await fetch('https://forums.e-hentai.org/index.php?act=Login&CODE=01', {
          method: 'POST',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: 'https://forums.e-hentai.org/index.php?act=Login&CODE=00',
            Origin: 'https://forums.e-hentai.org',
          },
          body: form.toString(),
          redirect: 'manual',
        });

        const setCookies =
          typeof loginRes.headers.getSetCookie === 'function'
            ? loginRes.headers.getSetCookie()
            : [loginRes.headers.get('set-cookie') || ''];
        const joined = setCookies.join('; ');
        const memberMatch = joined.match(/ipb_member_id=([^;]+)/i);
        const passMatch = joined.match(/ipb_pass_hash=([^;]+)/i);

        if (memberMatch && passMatch && memberMatch[1] !== '0' && passMatch[1] !== '0') {
          const cookie = `ipb_member_id=${memberMatch[1]}; ipb_pass_hash=${passMatch[1]}`;
          return jsonResponse(request, { ok: true, cookie });
        }

        const html = await loginRes.text();
        if (html.toLowerCase().includes('captcha') || html.toLowerCase().includes('recaptcha')) {
          return jsonResponse(
            request,
            {
              error:
                'E-Hentai 官网本次登录触发了人机验证码，无法通过账号密码接口直接完成。请切换到「Cookie 导入」按教程粘贴 Cookie 即可登录。',
            },
            403
          );
        }

        return jsonResponse(
          request,
          { error: '登录失败：用户名或密码错误，或官网要求网页验证。建议改用 Cookie 导入。' },
          401
        );
      }

      if (pathname === '/api/favorite' && request.method === 'POST') {
        const body = (await request.json().catch(() => ({}))) as {
          gid?: string;
          token?: string;
          site?: EhSite;
        };
        const ctx = getContext(request);
        const site = parseSite(body.site || ctx.site);
        if (!body.gid) return jsonResponse(request, { error: '缺少作品 ID' }, 400);

        if (site === 'pixiv') {
          const result = await pixivAddBookmark(body.gid, ctx.pixivCookie);
          return jsonResponse(request, result);
        }
        if (site === 'e-hentai' || site === 'exhentai') {
          if (!body.token) return jsonResponse(request, { error: '缺少画廊 token' }, 400);
          const result = await ehAddFavorite(site, body.gid, body.token, ctx.cookie);
          return jsonResponse(request, result);
        }
        return jsonResponse(request, { error: '该站点暂仅支持本地书架收藏' }, 400);
      }

      const demoImgMatch = pathname.match(/^\/api\/demo-image\/([^/]+)\/(\d+)$/);
      if (demoImgMatch) {
        const svg = renderDemoSvg(demoImgMatch[1], parseInt(demoImgMatch[2], 10) || 0);
        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400',
            ...corsHeaders(request),
          },
        });
      }

      if (pathname === '/api/galleries') {
        const tab = url.searchParams.get('tab') || 'front';
        const q = (url.searchParams.get('q') || '').trim();
        const fCatsRaw = url.searchParams.get('f_cats');
        const fCats = fCatsRaw ? parseInt(fCatsRaw, 10) : undefined;
        const next = url.searchParams.get('next') || undefined;
        const prev = url.searchParams.get('prev') || undefined;
        const demo = url.searchParams.get('demo') === '1';

        if (demo) {
          return jsonResponse(request, getDemoGalleryList(q, fCats));
        }

        const ctx = getContext(request);
        if (ctx.site === 'pixiv') {
          return jsonResponse(request, await pixivFetchList(tab, q, next, ctx.pixivCookie));
        }
        if (ctx.site === 'jmcomic') {
          return jsonResponse(
            request,
            await jmFetchList(ctx.jmDomain, tab, q, next, ctx.jmCookie)
          );
        }

        const base = getSiteBaseUrl(ctx.site);
        let seg = '/';
        if (tab === 'popular') seg = '/popular';
        else if (tab === 'watched') seg = '/watched';
        else if (tab === 'favorites') seg = '/favorites.php';

        const target = new URL(seg, base);
        target.searchParams.set('inline_set', 'dm_l');
        if (q) target.searchParams.set('f_search', q);
        if (typeof fCats === 'number' && !Number.isNaN(fCats) && fCats > 0 && tab !== 'popular') {
          target.searchParams.set('f_cats', String(fCats));
        }
        if (next) target.searchParams.set('next', next);
        if (prev) target.searchParams.set('prev', prev);

        const html = await fetchEhHtml(target.toString(), ctx);
        const parsed = parseGalleryListHtml(html, ctx.site);
        assertValidGalleryListHtml(html, parsed.items.length, ctx.site);
        return jsonResponse(request, parsed);
      }

      const jmChapterMatch = pathname.match(/^\/api\/jm-chapter\/(\d+)$/);
      if (jmChapterMatch) {
        const ctx = getContext(request);
        const previews = await jmFetchChapterPreviews(
          ctx.jmDomain,
          jmChapterMatch[1],
          ctx.jmCookie
        );
        return jsonResponse(request, { photoId: jmChapterMatch[1], previews });
      }

      const detailMatch = pathname.match(/^\/api\/gallery\/(\d+)\/([a-z0-9]+)$/i);
      if (detailMatch) {
        const [, gid, token] = detailMatch;
        const p = Math.max(0, parseInt(url.searchParams.get('p') || '0', 10) || 0);
        if (url.searchParams.get('demo') === '1') {
          const detail = getDemoGalleryDetail(gid);
          return detail
            ? jsonResponse(request, detail)
            : jsonResponse(request, { error: '画廊不存在' }, 404);
        }

        const ctx = getContext(request);
        if (token === 'pixiv' || ctx.site === 'pixiv') {
          return jsonResponse(request, await pixivFetchDetail(gid, ctx.pixivCookie));
        }
        if (token === 'jm' || ctx.site === 'jmcomic') {
          return jsonResponse(request, await jmFetchDetail(ctx.jmDomain, gid, ctx.jmCookie));
        }

        const target = new URL(`/g/${gid}/${token}/`, getSiteBaseUrl(ctx.site));
        if (p > 0) target.searchParams.set('p', String(p));

        const html = await fetchEhHtml(target.toString(), ctx);
        return jsonResponse(request, parseGalleryDetailHtml(html, gid, token, p, ctx.site));
      }

      const pageMatch = pathname.match(/^\/api\/image-page\/(\d+)\/([a-z0-9]+)\/(\d+)$/i);
      if (pageMatch) {
        const [, gid, pageToken, pageStr] = pageMatch;
        const page = Math.max(1, parseInt(pageStr, 10) || 1);
        const nl = url.searchParams.get('nl') || undefined;
        if (url.searchParams.get('demo') === '1') {
          return jsonResponse(request, getDemoReaderPage(gid, page));
        }

        const ctx = getContext(request);
        const target = new URL(`/s/${pageToken}/${gid}-${page}`, getSiteBaseUrl(ctx.site));
        if (nl) target.searchParams.set('nl', nl);

        const html = await fetchEhHtml(target.toString(), ctx);
        const parsed = parseReaderPageHtml(html, gid, pageToken, page);
        if (!parsed.imageUrl) {
          return jsonResponse(request, { error: '未能解析到原图地址，请重试。' }, 502);
        }
        return jsonResponse(request, parsed);
      }

      if (pathname === '/api/tag-db') {
        const sources = [
          'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.text.json',
          'https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json',
        ];
        let raw: EhTagDbRaw | null = null;
        for (const src of sources) {
          try {
            const r = await fetch(src, { headers: { 'User-Agent': 'EhWeb/1.0' } });
            if (r.ok) {
              raw = (await r.json()) as EhTagDbRaw;
              if (raw?.data) break;
            }
          } catch {
            // try next mirror
          }
        }
        if (!raw?.data) {
          return jsonResponse(request, { error: '无法获取 EhTagTranslation 词库' }, 502);
        }
        const map: Record<string, string> = {};
        for (const group of raw.data) {
          const ns = group.namespace;
          if (!ns || ns === 'rows' || !group.data) continue;
          for (const [tag, entry] of Object.entries(group.data)) {
            if (entry?.name) map[`${ns}:${tag}`] = entry.name;
          }
        }
        return jsonResponse(
          request,
          {
            version: raw.head?.sha?.slice(0, 7) || new Date().toISOString().slice(0, 10),
            count: Object.keys(map).length,
            fetchedAt: Date.now(),
            map,
          },
          200,
          { 'Cache-Control': 'public, max-age=43200' }
        );
      }

      if (pathname === '/api/proxy-image') {
        const targetUrl = url.searchParams.get('url') || '';
        const ctx = getContext(request);
        if (!targetUrl || !isAllowedImageUrl(targetUrl, ctx.jmDomain)) {
          return jsonResponse(request, { error: '非法的图片代理地址' }, 400);
        }

        const parsedHost = new URL(targetUrl).hostname;
        const isPixiv = /pximg\.net$|pixiv\.net$/i.test(parsedHost);
        const isJm = /18comic|jmcomic|cdn-msp|jmapiproxy/i.test(parsedHost);

        const referer = isPixiv
          ? 'https://www.pixiv.net/'
          : isJm
            ? `${ctx.jmDomain || DEFAULT_JM_DOMAIN}/`
            : getSiteBaseUrl(ctx.site) + '/';

        const headers: Record<string, string> = {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          Referer: referer,
        };
        if (!isPixiv && !isJm) {
          headers.Cookie = buildCookieHeader(ctx.cookie);
        }

        const imgRes = await fetch(targetUrl, { headers, redirect: 'follow' });
        if (!imgRes.ok) {
          return jsonResponse(
            request,
            { error: `图片加载失败 (HTTP ${imgRes.status})` },
            imgRes.status
          );
        }
        return new Response(imgRes.body, {
          status: 200,
          headers: {
            'Content-Type': imgRes.headers.get('content-type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=604800, immutable',
            ...corsHeaders(request),
          },
        });
      }

      return jsonResponse(request, { error: 'Not Found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Worker 内部错误';
      return jsonResponse(request, { error: message }, 502);
    }
  },
};
