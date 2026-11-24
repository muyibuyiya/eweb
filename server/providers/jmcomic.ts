import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import type {
  GalleryChapter,
  GalleryDetail,
  GalleryListResponse,
  GalleryPreviewPage,
  GallerySummary,
} from '../../shared/types.js';

export const DEFAULT_JM_DOMAIN = 'https://18comic.vip';

const JM_APP_VERSION = '1.7.5';
const JM_TOKEN_SECRET = '18comicAPP';
const JM_DATA_SECRET = '185Hcomic3PAPP7R';

const JM_API_DOMAINS = [
  'https://www.cdnblackmyth.club',
  'https://www.cdnmhwscc.vip',
  'https://www.cdnuc.vip',
  'https://www.cdn-mspjmapiproxy.xyz',
];

const JM_IMAGE_CDN = 'https://cdn-msp.jmapiproxy1.cc';

function md5(text: string): string {
  return crypto.createHash('md5').update(text).digest('hex');
}

function decryptJmData<T>(encryptedBase64: string, ts: number): T {
  const key = Buffer.from(md5(`${ts}${JM_DATA_SECRET}`), 'utf8'); // 32 bytes = AES-256
  const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return JSON.parse(decrypted) as T;
}

async function jmApiGet<T>(
  pathWithQuery: string,
  cookie?: string,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const ts = Math.floor(Date.now() / 1000);
  const token = md5(`${ts}${JM_TOKEN_SECRET}`);
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    token,
    tokenparam: `${ts},${JM_APP_VERSION}`,
  };
  if (cookie?.trim()) {
    headers.Cookie = cookie.trim();
  }

  let lastErr: unknown;
  for (const base of JM_API_DOMAINS) {
    try {
      const res = await fetchImpl(`${base}${pathWithQuery}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status} (${base})`);
        continue;
      }
      const json = (await res.json()) as { code?: number; data?: unknown; errorMsg?: string };
      if (json.code && json.code !== 200) {
        lastErr = new Error(json.errorMsg || `JM API code ${json.code}`);
        continue;
      }
      if (typeof json.data === 'string') {
        return decryptJmData<T>(json.data, ts);
      }
      if (json.data && typeof json.data === 'object') {
        return json.data as T;
      }
      lastErr = new Error('JM API 返回空数据');
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('所有禁漫 App API 节点均无法连接');
}

interface JmApiAlbumItem {
  id: string | number;
  name?: string;
  author?: string;
  category?: { title?: string };
  total_views?: string | number;
  likes?: string | number;
}

interface JmApiListData {
  content?: JmApiAlbumItem[];
  total?: string | number;
}

interface JmApiAlbumDetail {
  id: string | number;
  name?: string;
  author?: string[] | string;
  tags?: string[];
  description?: string;
  total_views?: string | number;
  likes?: string | number;
  series?: Array<{ id: string | number; sort?: string; name?: string }>;
  images?: string[];
}

interface JmApiChapterDetail {
  id: string | number;
  name?: string;
  images?: string[];
}

function normalizeDomain(raw?: string): string {
  const cleaned = (raw || DEFAULT_JM_DOMAIN).trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

function jmHtmlHeaders(domain: string, cookie?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: `${domain}/`,
  };
  if (cookie?.trim()) {
    headers.Cookie = cookie.trim();
  }
  return headers;
}

function resolveUrl(raw: string | undefined, domain: string): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${domain}${raw}`;
  return `${domain}/${raw}`;
}

async function fetchJmHtmlFallback(
  url: string,
  domain: string,
  cookie?: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: jmHtmlHeaders(domain, cookie),
    redirect: 'follow',
  });
  const html = await res.text();
  if (
    res.status === 403 ||
    res.status === 503 ||
    html.includes('Just a moment...') ||
    html.includes('cf-browser-verification')
  ) {
    throw new Error(
      `禁漫 App API 与网页镜像 (${domain}) 在当前云端节点均受限。建议部署到你的 AWS 悉尼服务器或本机 Node 服务即可畅通访问。`
    );
  }
  if (!res.ok) {
    throw new Error(`禁漫请求失败 (HTTP ${res.status})`);
  }
  return html;
}

export async function jmFetchList(
  rawDomain: string | undefined,
  tab: string,
  query: string,
  pageStr: string | undefined,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryListResponse> {
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);
  const order = tab === 'popular' ? 'mv' : tab === 'watched' ? 'tf' : 'mr';

  // 1. Try JMComic Mobile App API first (bypasses web Cloudflare WAF!)
  if (tab !== 'favorites') {
    try {
      const apiPath = query.trim()
        ? `/search?search_query=${encodeURIComponent(query.trim())}&page=${page}&o=${order}`
        : `/categories/filter?page=${page}&o=${order}&c=0`;
      const data = await jmApiGet<JmApiListData>(apiPath, cookie, fetchImpl);
      const list = Array.isArray(data?.content) ? data.content : [];
      if (list.length > 0) {
        const items: GallerySummary[] = list.map((item) => {
          const aid = String(item.id);
          return {
            gid: aid,
            token: 'jm',
            title: item.name || `JM-${aid}`,
            category: 'JMComic',
            thumb: `${JM_IMAGE_CDN}/media/albums/${aid}_3x4.jpg`,
            posted: `JM${aid}`,
            uploader: item.author || '禁漫天堂',
            rating: 4.8,
            pages: 0,
            tags: item.category?.title ? [item.category.title] : [],
            site: 'jmcomic',
          };
        });
        const total = Number(data.total) || items.length;
        return {
          items,
          nextCursor: items.length >= 20 ? String(page + 1) : null,
          prevCursor: page > 1 ? String(page - 1) : null,
          totalText: `禁漫 App API · 第 ${page} 页${total ? ` (共 ${total} 本)` : ''}`,
          source: 'jmcomic',
        };
      }
    } catch {
      // Fall back to HTML parser below
    }
  }

  // 2. HTML fallback (works on residential/VPS IPs or custom mirror domains)
  const domain = normalizeDomain(rawDomain);
  let targetUrl: string;
  if (query.trim()) {
    targetUrl = `${domain}/search/photos?main_tag=0&search_query=${encodeURIComponent(
      query.trim()
    )}&page=${page}`;
  } else if (tab === 'favorites') {
    if (!cookie?.trim()) {
      throw new Error('请先在设置中导入禁漫天堂 AVS Cookie 后查看账号收藏。');
    }
    targetUrl = `${domain}/user/favorites?page=${page}`;
  } else {
    targetUrl = `${domain}/albums?o=${order}&page=${page}`;
  }

  const html = await fetchJmHtmlFallback(targetUrl, domain, cookie, fetchImpl);
  const $ = cheerio.load(html);
  const items: GallerySummary[] = [];
  const seen = new Set<string>();

  $('a[href*="/album/"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href') || '';
    const match = href.match(/\/album\/(\d+)/);
    if (!match) return;
    const aid = match[1];
    if (seen.has(aid)) return;

    const $card = $a.closest('.p-b-15, .list-col, .thumb-overlay, .col-xs-6, .col-sm-4, .col-md-3').first();
    const $scope = $card.length > 0 ? $card : $a.parent();

    const $img = $scope.find('img').first();
    const thumbRaw =
      $img.attr('data-original') || $img.attr('data-src') || $img.attr('src') || '';
    if (!thumbRaw || thumbRaw.includes('blank.jpg')) return;

    const title =
      $scope.find('.video-title, .title-truncate, span.title').first().text().trim() ||
      $img.attr('title')?.trim() ||
      $img.attr('alt')?.trim() ||
      $a.attr('title')?.trim() ||
      `JM-${aid}`;

    const uploader =
      $scope.find('.title-truncate a, .author').first().text().trim() || '禁漫天堂';

    seen.add(aid);
    items.push({
      gid: aid,
      token: 'jm',
      title,
      category: 'JMComic',
      thumb: resolveUrl(thumbRaw, domain),
      posted: `JM${aid}`,
      uploader,
      rating: 4.8,
      pages: 0,
      tags: [],
      site: 'jmcomic',
    });
  });

  const hasNext =
    $('a.prevnext[href*="page="], ul.pagination a[rel="next"]').length > 0 || items.length >= 20;

  return {
    items,
    nextCursor: hasNext ? String(page + 1) : null,
    prevCursor: page > 1 ? String(page - 1) : null,
    totalText: `禁漫天堂 · 第 ${page} 页`,
    source: 'jmcomic',
  };
}

function buildApiPreviews(photoId: string, images: string[]): GalleryPreviewPage[] {
  const aidNum = parseInt(photoId, 10) || 0;
  const shouldScramble = aidNum >= 220980;
  return images.map((imgName, idx) => {
    const fullUrl = imgName.startsWith('http')
      ? imgName
      : `${JM_IMAGE_CDN}/media/photos/${photoId}/${imgName}`;
    const pageName = imgName.replace(/\.[^.]+$/, '');
    const isGif = imgName.toLowerCase().endsWith('.gif');
    return {
      page: idx + 1,
      pageToken: `jm${photoId}p${idx + 1}`,
      thumbUrl: fullUrl,
      directImageUrl: fullUrl,
      scrambleAid: shouldScramble && !isGif ? aidNum : undefined,
      scramblePageName: shouldScramble && !isGif ? pageName : undefined,
    };
  });
}

export async function jmFetchChapterPreviews(
  rawDomain: string | undefined,
  photoId: string,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryPreviewPage[]> {
  // 1. Try Mobile App API first
  try {
    const data = await jmApiGet<JmApiChapterDetail>(`/chapter?id=${photoId}`, cookie, fetchImpl);
    if (Array.isArray(data?.images) && data.images.length > 0) {
      return buildApiPreviews(photoId, data.images);
    }
  } catch {
    // fallback to HTML
  }

  // 2. HTML fallback
  const domain = normalizeDomain(rawDomain);
  const html = await fetchJmHtmlFallback(`${domain}/photo/${photoId}/`, domain, cookie, fetchImpl);
  const $ = cheerio.load(html);
  const previews: GalleryPreviewPage[] = [];
  const aidNum = parseInt(photoId, 10) || 0;

  const scrambleIdMatch = html.match(/var\s+scramble_id\s*=\s*(\d+)/);
  const scrambleThreshold = scrambleIdMatch ? parseInt(scrambleIdMatch[1], 10) : 220980;
  const shouldScramble = aidNum >= scrambleThreshold;

  $('.scramble-page img, .panel-body img[data-original], img.lazy_img').each((_, img) => {
    const $img = $(img);
    const src = $img.attr('data-original') || $img.attr('data-src') || $img.attr('src') || '';
    if (!src || src.includes('blank.jpg') || src.includes('logo')) return;
    const fullUrl = resolveUrl(src, domain);
    const fileName = fullUrl.split('/').pop()?.split('?')[0] || '';
    const pageName = fileName.replace(/\.[^.]+$/, '');
    const pageNum = previews.length + 1;

    previews.push({
      page: pageNum,
      pageToken: `jm${photoId}p${pageNum}`,
      thumbUrl: fullUrl,
      directImageUrl: fullUrl,
      scrambleAid: shouldScramble && !fileName.endsWith('.gif') ? aidNum : undefined,
      scramblePageName: shouldScramble && !fileName.endsWith('.gif') ? pageName : undefined,
    });
  });

  return previews;
}

export async function jmFetchDetail(
  rawDomain: string | undefined,
  aid: string,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryDetail> {
  // 1. Try Mobile App API first
  try {
    const data = await jmApiGet<JmApiAlbumDetail>(`/album?id=${aid}`, cookie, fetchImpl);
    if (data?.id || data?.name) {
      const chapters: GalleryChapter[] =
        Array.isArray(data.series) && data.series.length > 0
          ? data.series.map((s, idx) => ({
              id: String(s.id),
              title: s.name || `第 ${s.sort || idx + 1} 话`,
              order: String(s.sort || idx + 1),
            }))
          : [{ id: aid, title: '全一话', order: '1' }];

      const firstChapterId = chapters[0].id;
      let previews: GalleryPreviewPage[] = [];
      if (Array.isArray(data.images) && data.images.length > 0 && firstChapterId === aid) {
        previews = buildApiPreviews(aid, data.images);
      } else {
        previews = await jmFetchChapterPreviews(rawDomain, firstChapterId, cookie, fetchImpl);
      }

      const authorStr = Array.isArray(data.author)
        ? data.author.join(', ')
        : data.author || '禁漫天堂';
      const tags = Array.isArray(data.tags) ? data.tags.filter(Boolean) : [];

      return {
        gid: aid,
        token: 'jm',
        title: data.name || `JM-${aid}`,
        titleJpn: `JM${aid}`,
        category: 'JMComic',
        thumb: `${JM_IMAGE_CDN}/media/albums/${aid}_3x4.jpg`,
        uploader: authorStr || '禁漫天堂',
        posted: `JM${aid}`,
        visible: 'Yes',
        language: '中文',
        fileSize: chapters.length > 1 ? `${chapters.length} 章节` : '单话',
        pages: previews.length,
        favoritedCount: Number(data.likes) || 0,
        rating: 4.8,
        ratingCount: Number(data.total_views) || 0,
        tagGroups: tags.length > 0 ? [{ namespace: 'tags', tags }] : [],
        previews,
        previewPageCount: 1,
        currentPreviewPage: 0,
        comments: data.description
          ? [
              {
                id: 'jm-desc',
                author: '简介',
                postedAt: `JM${aid}`,
                score: '',
                isUploader: true,
                html: data.description,
                text: data.description,
              },
            ]
          : [],
        chapters,
        source: 'jmcomic',
      };
    }
  } catch {
    // fallback to HTML
  }

  // 2. HTML fallback
  const domain = normalizeDomain(rawDomain);
  const html = await fetchJmHtmlFallback(`${domain}/album/${aid}/`, domain, cookie, fetchImpl);
  const $ = cheerio.load(html);

  const title =
    $('h1#book-name, h1.book-name, h1').first().text().trim() || `JM-${aid}`;

  const $coverImg = $('.thumb-overlay img, .show_zoom img, #album_photo_cover img').first();
  const thumb = resolveUrl(
    $coverImg.attr('data-original') || $coverImg.attr('src') || '',
    domain
  );

  const tags: string[] = [];
  $('span[data-type="tags"] a, .tag-block a').each((_, a) => {
    const t = $(a).text().trim();
    if (t) tags.push(t);
  });

  const author =
    $('span[data-type="author"] a').first().text().trim() || '禁漫天堂';

  const chapters: GalleryChapter[] = [];
  const seenCh = new Set<string>();
  $('ul.btn-toolbar a[href*="/photo/"], .episode a[href*="/photo/"]').each((_, a) => {
    const href = $(a).attr('href') || '';
    const m = href.match(/\/photo\/(\d+)/);
    if (!m || seenCh.has(m[1])) return;
    seenCh.add(m[1]);
    chapters.push({
      id: m[1],
      title: $(a).text().replace(/\s+/g, ' ').trim() || `第 ${chapters.length + 1} 话`,
      order: String(chapters.length + 1),
    });
  });

  const firstChapterId = chapters[0]?.id || aid;
  let previews: GalleryPreviewPage[] = [];
  try {
    previews = await jmFetchChapterPreviews(domain, firstChapterId, cookie, fetchImpl);
  } catch {
    previews = [];
  }

  return {
    gid: aid,
    token: 'jm',
    title,
    titleJpn: `JM${aid}`,
    category: 'JMComic',
    thumb,
    uploader: author,
    posted: `JM${aid}`,
    visible: 'Yes',
    language: '中文',
    fileSize: chapters.length > 1 ? `${chapters.length} 章节` : '单话',
    pages: previews.length,
    favoritedCount: 0,
    rating: 4.8,
    ratingCount: 0,
    tagGroups: tags.length > 0 ? [{ namespace: 'tags', tags: Array.from(new Set(tags)) }] : [],
    previews,
    previewPageCount: 1,
    currentPreviewPage: 0,
    comments: [],
    chapters: chapters.length > 0 ? chapters : [{ id: aid, title: '全一话', order: '1' }],
    source: 'jmcomic',
  };
}
