import { fetch as undiciFetch, ProxyAgent, type Dispatcher } from 'undici';
import type { EhSite } from '../shared/types.js';

export interface RequestContext {
  site: EhSite;
  cookie?: string;
  proxyUrl?: string;
}

const proxyAgentCache = new Map<string, ProxyAgent>();

function getDispatcher(proxyUrl?: string): Dispatcher | undefined {
  const effectiveProxy =
    proxyUrl?.trim() ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    process.env.https_proxy ||
    process.env.http_proxy;

  if (!effectiveProxy) return undefined;

  let agent = proxyAgentCache.get(effectiveProxy);
  if (!agent) {
    agent = new ProxyAgent(effectiveProxy);
    proxyAgentCache.set(effectiveProxy, agent);
  }
  return agent;
}

export function getSiteBaseUrl(site: EhSite): string {
  return site === 'exhentai' ? 'https://exhentai.org' : 'https://e-hentai.org';
}

export function buildCookieHeader(rawCookie?: string): string {
  const parts = new Map<string, string>();
  // nw=1 bypasses the content warning interstitial on E-Hentai
  parts.set('nw', '1');

  if (rawCookie) {
    for (const segment of rawCookie.split(';')) {
      const idx = segment.indexOf('=');
      if (idx > 0) {
        const key = segment.slice(0, idx).trim();
        const value = segment.slice(idx + 1).trim();
        if (key && value) {
          parts.set(key, value);
        }
      }
    }
  }

  return Array.from(parts.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}

export class EhFetchError extends Error {
  status: number;
  code: string;
  constructor(message: string, status = 502, code = 'EH_FETCH_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function ehFetchHtml(url: string, ctx: RequestContext): Promise<string> {
  const dispatcher = getDispatcher(ctx.proxyUrl);
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Cookie: buildCookieHeader(ctx.cookie),
    Referer: getSiteBaseUrl(ctx.site) + '/',
  };

  let res;
  try {
    res = await undiciFetch(url, {
      method: 'GET',
      headers,
      dispatcher,
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new EhFetchError(
      `无法连接到 ${ctx.site === 'exhentai' ? 'ExHentai' : 'E-Hentai'} (${msg})。请检查网络或在设置中配置代理，也可以开启「演示模式」体验界面。`,
      504,
      'NETWORK_ERROR'
    );
  }

  const contentType = res.headers.get('content-type') || '';

  // ExHentai returns a GIF/PNG Sad Panda image when cookies are invalid or missing
  if (contentType.startsWith('image/')) {
    throw new EhFetchError(
      'ExHentai 返回了 Sad Panda（无访问权限）。请在设置中检查 ipb_member_id、ipb_pass_hash 与 igneous Cookie，或切换回 E-Hentai 表站。',
      403,
      'SAD_PANDA'
    );
  }

  const text = await res.text();

  if (!res.ok) {
    throw new EhFetchError(`上游站点返回 HTTP ${res.status}`, res.status, 'UPSTREAM_HTTP_ERROR');
  }

  if (!text.trim()) {
    throw new EhFetchError(
      '上游站点返回了空白页面（可能是 ExHentai Cookie 失效或 IP 被限制）。',
      403,
      'EMPTY_RESPONSE'
    );
  }

  if (text.includes('Your IP address has been temporarily banned')) {
    throw new EhFetchError('当前 IP 已被 E-Hentai 临时封禁，请稍后再试或更换代理节点。', 429, 'IP_BANNED');
  }

  return text;
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
];

export function isAllowedImageUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return ALLOWED_IMAGE_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

export async function ehFetchJson<T>(url: string, proxyUrl?: string): Promise<T> {
  const dispatcher = getDispatcher(proxyUrl);
  const res = await undiciFetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'EhWeb/1.0',
      Accept: 'application/json',
    },
    dispatcher,
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) {
    throw new EhFetchError(`词库下载失败 (HTTP ${res.status})`, res.status, 'TAG_DB_FETCH_ERROR');
  }
  return (await res.json()) as T;
}

export async function ehFetchBinary(
  url: string,
  ctx: RequestContext
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!isAllowedImageUrl(url)) {
    throw new EhFetchError('不允许代理该域名的图片资源', 400, 'DISALLOWED_HOST');
  }

  const parsedHost = new URL(url).hostname;
  const isPixiv = /pximg\.net$|pixiv\.net$/i.test(parsedHost);
  const isJm = /18comic|jmcomic|cdn-msp|jmapiproxy/i.test(parsedHost);
  const referer = isPixiv
    ? 'https://www.pixiv.net/'
    : isJm
      ? 'https://18comic.vip/'
      : getSiteBaseUrl(ctx.site) + '/';

  const dispatcher = getDispatcher(ctx.proxyUrl);
  const res = await undiciFetch(url, {
    method: 'GET',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      ...(!isPixiv && !isJm ? { Cookie: buildCookieHeader(ctx.cookie) } : {}),
      Referer: referer,
    },
    dispatcher,
    redirect: 'follow',
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new EhFetchError(`图片加载失败 (HTTP ${res.status})`, res.status, 'IMAGE_FETCH_ERROR');
  }

  const arrayBuffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}
