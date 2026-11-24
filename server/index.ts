import express, { type Request, type Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EhSite } from '../shared/types.js';
import {
  ehFetchBinary,
  ehFetchHtml,
  ehFetchJson,
  EhFetchError,
  getSiteBaseUrl,
  type RequestContext,
} from './ehClient.js';
import {
  parseGalleryDetailHtml,
  parseGalleryListHtml,
  parseReaderPageHtml,
} from './ehParser.js';
import {
  getDemoGalleryDetail,
  getDemoGalleryList,
  getDemoReaderPage,
  renderDemoSvg,
} from './demoData.js';
import {
  pixivAddBookmark,
  pixivFetchDetail,
  pixivFetchList,
} from './providers/pixiv.js';
import {
  DEFAULT_JM_DOMAIN,
  jmFetchChapterPreviews,
  jmFetchDetail,
  jmFetchList,
} from './providers/jmcomic.js';
import { ehAddFavorite } from './providers/ehFavorite.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(compression());
app.use(express.json({ limit: '256kb' }));

// In-memory session store so <img> proxy requests don't need raw cookies in URLs
interface SessionConfig {
  site: EhSite;
  cookie?: string;
  pixivCookie?: string;
  jmCookie?: string;
  jmDomain?: string;
  proxyUrl?: string;
  updatedAt: number;
}
const sessionStore = new Map<string, SessionConfig>();

const VALID_SITES = new Set<EhSite>(['e-hentai', 'exhentai', 'pixiv', 'jmcomic']);
function parseSite(raw?: string): EhSite {
  if (raw && VALID_SITES.has(raw as EhSite)) return raw as EhSite;
  return 'e-hentai';
}

function pruneSessions() {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [id, cfg] of sessionStore.entries()) {
    if (cfg.updatedAt < cutoff) sessionStore.delete(id);
  }
}

interface ExtendedContext extends RequestContext {
  pixivCookie?: string;
  jmCookie?: string;
  jmDomain?: string;
}

function getRequestContext(req: Request): ExtendedContext {
  const sid =
    (typeof req.query.sid === 'string' ? req.query.sid : undefined) ||
    (typeof req.headers['x-eh-sid'] === 'string' ? req.headers['x-eh-sid'] : undefined);

  const saved = sid && sessionStore.has(sid) ? sessionStore.get(sid)! : undefined;
  if (saved) saved.updatedAt = Date.now();

  const rawSite =
    (typeof req.headers['x-eh-site'] === 'string' ? req.headers['x-eh-site'] : undefined) ||
    (typeof req.query.site === 'string' ? req.query.site : undefined) ||
    saved?.site ||
    'e-hentai';

  return {
    site: parseSite(rawSite),
    cookie:
      (typeof req.headers['x-eh-cookie'] === 'string' ? req.headers['x-eh-cookie'] : undefined) ||
      saved?.cookie,
    pixivCookie:
      (typeof req.headers['x-pixiv-cookie'] === 'string'
        ? req.headers['x-pixiv-cookie']
        : undefined) || saved?.pixivCookie,
    jmCookie:
      (typeof req.headers['x-jm-cookie'] === 'string' ? req.headers['x-jm-cookie'] : undefined) ||
      saved?.jmCookie,
    jmDomain:
      (typeof req.headers['x-jm-domain'] === 'string' ? req.headers['x-jm-domain'] : undefined) ||
      saved?.jmDomain ||
      DEFAULT_JM_DOMAIN,
    proxyUrl:
      (typeof req.headers['x-eh-proxy'] === 'string' ? req.headers['x-eh-proxy'] : undefined) ||
      saved?.proxyUrl,
  };
}

function getLanUrls(port: number): string[] {
  const nets = os.networkInterfaces();
  const urls: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push(`http://${net.address}:${port}`);
      }
    }
  }
  return urls;
}

function handleError(res: Response, err: unknown) {
  if (err instanceof EhFetchError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const msg = err instanceof Error ? err.message : '未知服务器错误';
  res.status(500).json({ error: msg, code: 'INTERNAL_ERROR' });
}

// Health & LAN connection info
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    port: PORT,
    lanUrls: getLanUrls(PORT),
    envProxyConfigured: Boolean(process.env.HTTPS_PROXY || process.env.HTTP_PROXY),
  });
});

// Register or update session config (cookie/proxy/site) -> returns opaque sid
app.post('/api/session', (req, res) => {
  pruneSessions();
  const { sid, site, cookie, pixivCookie, jmCookie, jmDomain, proxyUrl } = req.body || {};
  const sessionId =
    typeof sid === 'string' && sid.length >= 16 && sid.length <= 64
      ? sid
      : crypto.randomBytes(16).toString('hex');

  sessionStore.set(sessionId, {
    site: parseSite(site),
    cookie: typeof cookie === 'string' ? cookie : undefined,
    pixivCookie: typeof pixivCookie === 'string' ? pixivCookie : undefined,
    jmCookie: typeof jmCookie === 'string' ? jmCookie : undefined,
    jmDomain: typeof jmDomain === 'string' ? jmDomain : DEFAULT_JM_DOMAIN,
    proxyUrl: typeof proxyUrl === 'string' ? proxyUrl : undefined,
    updatedAt: Date.now(),
  });

  res.json({ sid: sessionId });
});

app.post('/api/eh-login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: '请输入 E-Hentai 用户名和密码' });
      return;
    }
    const form = new URLSearchParams({
      referer: 'https://forums.e-hentai.org/index.php?',
      b: '',
      bt: '',
      UserName: String(username).trim(),
      PassWord: String(password),
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
      res.json({ ok: true, cookie: `ipb_member_id=${memberMatch[1]}; ipb_pass_hash=${passMatch[1]}` });
      return;
    }
    const html = await loginRes.text();
    if (html.toLowerCase().includes('captcha')) {
      res.status(403).json({
        error: 'E-Hentai 官网本次登录触发了人机验证码，请改用「Cookie 导入」方式登录。',
      });
      return;
    }
    res.status(401).json({ error: '登录失败：用户名或密码错误，或官网要求网页验证。' });
  } catch (err) {
    handleError(res, err);
  }
});

app.post('/api/favorite', async (req, res) => {
  try {
    const { gid, token, site } = req.body || {};
    const ctx = getRequestContext(req);
    const targetSite = parseSite(site || ctx.site);
    if (!gid) {
      res.status(400).json({ error: '缺少作品 ID' });
      return;
    }
    if (targetSite === 'pixiv') {
      res.json(await pixivAddBookmark(String(gid), ctx.pixivCookie));
      return;
    }
    if (targetSite === 'e-hentai' || targetSite === 'exhentai') {
      res.json(await ehAddFavorite(targetSite, String(gid), String(token || ''), ctx.cookie));
      return;
    }
    res.status(400).json({ error: '该站点暂仅支持本地书架收藏' });
  } catch (err) {
    handleError(res, err);
  }
});

app.get('/api/jm-chapter/:photoId', async (req, res) => {
  try {
    const ctx = getRequestContext(req);
    const previews = await jmFetchChapterPreviews(ctx.jmDomain, req.params.photoId, ctx.jmCookie);
    res.json({ photoId: req.params.photoId, previews });
  } catch (err) {
    handleError(res, err);
  }
});

// Demo SVG image generator
app.get('/api/demo-image/:gid/:page', (req, res) => {
  const gid = req.params.gid;
  const page = parseInt(req.params.page, 10) || 0;
  const svg = renderDemoSvg(gid, page);
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// Gallery list: front, popular, watched, favorites, search
app.get('/api/galleries', async (req, res) => {
  try {
    const tab = typeof req.query.tab === 'string' ? req.query.tab : 'front';
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const fCats =
      typeof req.query.f_cats === 'string' && req.query.f_cats !== ''
        ? parseInt(req.query.f_cats, 10)
        : undefined;
    const next = typeof req.query.next === 'string' ? req.query.next : undefined;
    const prev = typeof req.query.prev === 'string' ? req.query.prev : undefined;
    const demo = req.query.demo === '1';

    if (demo) {
      res.json(getDemoGalleryList(q, fCats));
      return;
    }

    const ctx = getRequestContext(req);
    if (ctx.site === 'pixiv') {
      res.json(await pixivFetchList(tab, q, next, ctx.pixivCookie));
      return;
    }
    if (ctx.site === 'jmcomic') {
      res.json(await jmFetchList(ctx.jmDomain, tab, q, next, ctx.jmCookie));
      return;
    }

    const base = getSiteBaseUrl(ctx.site);
    let pathSegment = '/';
    if (tab === 'popular') pathSegment = '/popular';
    else if (tab === 'watched') pathSegment = '/watched';
    else if (tab === 'favorites') pathSegment = '/favorites.php';

    const url = new URL(pathSegment, base);
    // Force compact display mode for reliable metadata parsing
    url.searchParams.set('inline_set', 'dm_l');

    if (q) url.searchParams.set('f_search', q);
    if (typeof fCats === 'number' && !Number.isNaN(fCats) && fCats > 0 && tab !== 'popular') {
      url.searchParams.set('f_cats', String(fCats));
    }
    if (next) url.searchParams.set('next', next);
    if (prev) url.searchParams.set('prev', prev);

    const html = await ehFetchHtml(url.toString(), ctx);
    const parsed = parseGalleryListHtml(html, ctx.site);
    res.json(parsed);
  } catch (err) {
    handleError(res, err);
  }
});

// Gallery detail
app.get('/api/gallery/:gid/:token', async (req, res) => {
  try {
    const { gid, token } = req.params;
    const pageIndex = Math.max(0, parseInt(String(req.query.p || '0'), 10) || 0);
    const demo = req.query.demo === '1';

    if (demo) {
      const detail = getDemoGalleryDetail(gid);
      if (!detail) {
        res.status(404).json({ error: '画廊不存在' });
        return;
      }
      res.json(detail);
      return;
    }

    const ctx = getRequestContext(req);
    if (token === 'pixiv' || ctx.site === 'pixiv') {
      res.json(await pixivFetchDetail(gid, ctx.pixivCookie));
      return;
    }
    if (token === 'jm' || ctx.site === 'jmcomic') {
      res.json(await jmFetchDetail(ctx.jmDomain, gid, ctx.jmCookie));
      return;
    }

    const base = getSiteBaseUrl(ctx.site);
    const url = new URL(`/g/${gid}/${token}/`, base);
    if (pageIndex > 0) url.searchParams.set('p', String(pageIndex));

    const html = await ehFetchHtml(url.toString(), ctx);
    const detail = parseGalleryDetailHtml(html, gid, token, pageIndex, ctx.site);
    res.json(detail);
  } catch (err) {
    handleError(res, err);
  }
});

// Reader single page image resolution
app.get('/api/image-page/:gid/:pageToken/:page', async (req, res) => {
  try {
    const { gid, pageToken } = req.params;
    const page = Math.max(1, parseInt(req.params.page, 10) || 1);
    const nl = typeof req.query.nl === 'string' ? req.query.nl : undefined;
    const demo = req.query.demo === '1';

    if (demo) {
      res.json(getDemoReaderPage(gid, page));
      return;
    }

    const ctx = getRequestContext(req);
    const base = getSiteBaseUrl(ctx.site);
    const url = new URL(`/s/${pageToken}/${gid}-${page}`, base);
    if (nl) url.searchParams.set('nl', nl);

    const html = await ehFetchHtml(url.toString(), ctx);
    const data = parseReaderPageHtml(html, gid, pageToken, page);
    if (!data.imageUrl) {
      throw new EhFetchError('未能解析到原图地址，请尝试重新加载。', 502, 'IMAGE_PARSE_FAILED');
    }
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// Fetch & compact EhTagTranslation Chinese database
interface EhTagDbRaw {
  head?: { sha?: string };
  data?: Array<{
    namespace: string;
    data: Record<string, { name?: string }>;
  }>;
}

let cachedTagDb: { version: string; count: number; map: Record<string, string>; fetchedAt: number } | null = null;

app.get('/api/tag-db', async (req, res) => {
  try {
    const force = req.query.force === '1';
    if (!force && cachedTagDb && Date.now() - cachedTagDb.fetchedAt < 12 * 60 * 60 * 1000) {
      res.json(cachedTagDb);
      return;
    }

    const ctx = getRequestContext(req);
    const urls = [
      'https://cdn.jsdelivr.net/gh/EhTagTranslation/DatabaseReleases@master/db.text.json',
      'https://raw.githubusercontent.com/EhTagTranslation/DatabaseReleases/master/db.text.json',
    ];

    let raw: EhTagDbRaw | null = null;
    let lastErr: unknown;
    for (const u of urls) {
      try {
        raw = await ehFetchJson<EhTagDbRaw>(u, ctx.proxyUrl);
        if (raw?.data) break;
      } catch (e) {
        lastErr = e;
      }
    }

    if (!raw?.data) {
      throw lastErr instanceof Error ? lastErr : new EhFetchError('无法下载 EhTagTranslation 中文词库', 502);
    }

    const map: Record<string, string> = {};
    for (const group of raw.data) {
      const ns = group.namespace;
      if (!ns || ns === 'rows' || !group.data) continue;
      for (const [tag, entry] of Object.entries(group.data)) {
        if (entry?.name) {
          map[`${ns}:${tag}`] = entry.name;
        }
      }
    }

    cachedTagDb = {
      version: raw.head?.sha?.slice(0, 7) || new Date().toISOString().slice(0, 10),
      count: Object.keys(map).length,
      map,
      fetchedAt: Date.now(),
    };

    res.json(cachedTagDb);
  } catch (err) {
    handleError(res, err);
  }
});

// Image proxy with host allowlist
app.get('/api/proxy-image', async (req, res) => {
  try {
    const targetUrl = typeof req.query.url === 'string' ? req.query.url : '';
    if (!targetUrl) {
      res.status(400).json({ error: '缺少 url 参数' });
      return;
    }

    const ctx = getRequestContext(req);
    const { buffer, contentType } = await ehFetchBinary(targetUrl, ctx);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(buffer);
  } catch (err) {
    handleError(res, err);
  }
});

// Serve built frontend in production
const candidateDistDirs = [
  path.resolve(__dirname, '../../dist'),
  path.resolve(__dirname, '../dist'),
  path.resolve(process.cwd(), 'dist'),
];
const distDir = candidateDistDirs.find((d) => fs.existsSync(path.join(d, 'index.html')));
if (distDir) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✨ EhWeb Server running on http://localhost:${PORT}`);
  const lanUrls = getLanUrls(PORT);
  if (lanUrls.length > 0) {
    console.log(`📱 Open on iPhone Safari (same Wi-Fi):`);
    for (const u of lanUrls) {
      console.log(`   → ${u}`);
    }
  }
  console.log('');
});
