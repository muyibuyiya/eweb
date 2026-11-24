import * as cheerio from 'cheerio';
import type {
  GalleryChapter,
  GalleryDetail,
  GalleryListResponse,
  GalleryPreviewPage,
  GallerySummary,
} from '../../shared/types.js';

export const DEFAULT_JM_DOMAIN = 'https://18comic.vip';

function normalizeDomain(raw?: string): string {
  const cleaned = (raw || DEFAULT_JM_DOMAIN).trim().replace(/\/+$/, '');
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    return `https://${cleaned}`;
  }
  return cleaned;
}

function jmHeaders(domain: string, cookie?: string): Record<string, string> {
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

async function fetchJmHtml(
  url: string,
  domain: string,
  cookie?: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: jmHeaders(domain, cookie),
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
      `禁漫域名 (${domain}) 触发了人机验证或访问限制。请在「设置 → 禁漫镜像域名」中更换可用镜像站（如 https://18comic.org 或最新发布页域名）。`
    );
  }
  if (!res.ok) {
    throw new Error(`禁漫请求失败 (HTTP ${res.status})`);
  }
  return html;
}

function resolveUrl(raw: string | undefined, domain: string): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${domain}${raw}`;
  return `${domain}/${raw}`;
}

export async function jmFetchList(
  rawDomain: string | undefined,
  tab: string,
  query: string,
  pageStr: string | undefined,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryListResponse> {
  const domain = normalizeDomain(rawDomain);
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);

  let targetUrl: string;
  if (query.trim()) {
    targetUrl = `${domain}/search/photos?main_tag=0&search_query=${encodeURIComponent(
      query.trim()
    )}&page=${page}`;
  } else if (tab === 'favorites') {
    if (!cookie?.trim()) {
      throw new Error('请先在设置中导入禁漫天堂 Cookie 后查看账号收藏。');
    }
    targetUrl = `${domain}/user/favorites?page=${page}`;
  } else {
    const order = tab === 'popular' ? 'mv' : tab === 'watched' ? 'tf' : 'mr';
    targetUrl = `${domain}/albums?o=${order}&page=${page}`;
  }

  const html = await fetchJmHtml(targetUrl, domain, cookie, fetchImpl);
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

    const tags: string[] = [];
    $scope.find('.tag, .label').each((__, tEl) => {
      const t = $(tEl).text().trim();
      if (t && t.length < 24) tags.push(t);
    });

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
      tags: tags.slice(0, 5),
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

export async function jmFetchChapterPreviews(
  rawDomain: string | undefined,
  photoId: string,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryPreviewPage[]> {
  const domain = normalizeDomain(rawDomain);
  const html = await fetchJmHtml(`${domain}/photo/${photoId}/`, domain, cookie, fetchImpl);
  const $ = cheerio.load(html);
  const previews: GalleryPreviewPage[] = [];
  const aidNum = parseInt(photoId, 10) || 0;

  // Check if scramble_id is present in page scripts (JMComic scrambles chapters >= 220980)
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
  const domain = normalizeDomain(rawDomain);
  const html = await fetchJmHtml(`${domain}/album/${aid}/`, domain, cookie, fetchImpl);
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
