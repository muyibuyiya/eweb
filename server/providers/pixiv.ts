import type {
  GalleryDetail,
  GalleryListResponse,
  GalleryPreviewPage,
  GallerySummary,
} from '../../shared/types.js';

const PIXIV_BASE = 'https://www.pixiv.net';

function pixivHeaders(cookie?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: 'https://www.pixiv.net/ranking.php',
    'X-Requested-With': 'XMLHttpRequest',
  };
  if (cookie?.trim()) {
    headers.Cookie = cookie.trim();
  }
  return headers;
}

function extractPixivUserId(cookie?: string): string | null {
  if (!cookie) return null;
  const match = cookie.match(/PHPSESSID=(\d+)_/i);
  return match ? match[1] : null;
}

interface PixivRankingItem {
  illust_id: number;
  title: string;
  user_name: string;
  date: string;
  url: string;
  illust_page_count: string | number;
  tags?: string[];
  rating_count?: number;
  view_count?: number;
}

interface PixivSearchIllust {
  id: string;
  title: string;
  userName: string;
  createDate?: string;
  url: string;
  pageCount: number;
  tags?: string[];
}

export async function pixivFetchList(
  tab: string,
  query: string,
  pageStr: string | undefined,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryListResponse> {
  const page = Math.max(1, parseInt(pageStr || '1', 10) || 1);

  // 1. User official bookmarks (requires PHPSESSID)
  if (tab === 'favorites') {
    const uid = extractPixivUserId(cookie);
    if (!uid) {
      throw new Error('请先在设置中导入 Pixiv 的 PHPSESSID Cookie 后查看账号收藏。');
    }
    const offset = (page - 1) * 24;
    const url = `${PIXIV_BASE}/ajax/user/${uid}/illusts/bookmarks?tag=&offset=${offset}&limit=24&rest=show&lang=zh`;
    const res = await fetchImpl(url, { headers: pixivHeaders(cookie) });
    if (!res.ok) throw new Error(`Pixiv 收藏获取失败 (HTTP ${res.status})`);
    const json = (await res.json()) as {
      error?: boolean;
      message?: string;
      body?: { works?: PixivSearchIllust[]; total?: number };
    };
    if (json.error) throw new Error(json.message || 'Pixiv Cookie 无效或已过期');
    const works = json.body?.works || [];
    const items: GallerySummary[] = works.map((w) => ({
      gid: String(w.id),
      token: 'pixiv',
      title: w.title || 'Untitled',
      category: 'Pixiv',
      thumb: w.url,
      posted: (w.createDate || '').slice(0, 10),
      uploader: w.userName || 'Pixiv Artist',
      rating: 4.8,
      pages: Number(w.pageCount) || 1,
      tags: (w.tags || []).slice(0, 6),
      site: 'pixiv',
    }));
    const total = json.body?.total || items.length;
    return {
      items,
      nextCursor: offset + items.length < total ? String(page + 1) : null,
      prevCursor: page > 1 ? String(page - 1) : null,
      totalText: `Pixiv 账号收藏 · 共 ${total} 作品`,
      source: 'pixiv',
    };
  }

  // 2. Search artworks
  if (query.trim()) {
    const encoded = encodeURIComponent(query.trim());
    const url = `${PIXIV_BASE}/ajax/search/artworks/${encoded}?word=${encoded}&order=date_d&mode=all&p=${page}&s_mode=s_tag&type=all&lang=zh`;
    const res = await fetchImpl(url, { headers: pixivHeaders(cookie) });
    if (!res.ok) throw new Error(`Pixiv 搜索失败 (HTTP ${res.status})`);
    const json = (await res.json()) as {
      error?: boolean;
      message?: string;
      body?: {
        illustManga?: { data?: PixivSearchIllust[]; total?: number };
      };
    };
    if (json.error) throw new Error(json.message || 'Pixiv 搜索失败');
    const works = (json.body?.illustManga?.data || []).filter((w) => w && w.id);
    const total = json.body?.illustManga?.total || works.length;
    const items: GallerySummary[] = works.map((w) => ({
      gid: String(w.id),
      token: 'pixiv',
      title: w.title || 'Untitled',
      category: 'Pixiv',
      thumb: w.url,
      posted: (w.createDate || '').slice(0, 10),
      uploader: w.userName || 'Pixiv Artist',
      rating: 4.7,
      pages: Number(w.pageCount) || 1,
      tags: (w.tags || []).slice(0, 6),
      site: 'pixiv',
    }));
    return {
      items,
      nextCursor: items.length > 0 && page * 60 < total ? String(page + 1) : null,
      prevCursor: page > 1 ? String(page - 1) : null,
      totalText: `Pixiv 搜索 · 共 ${total} 个作品`,
      source: 'pixiv',
    };
  }

  // 3. Following artists latest (if tab === 'watched' and logged in)
  if (tab === 'watched' && extractPixivUserId(cookie)) {
    const url = `${PIXIV_BASE}/ajax/follow_latest/illust?p=${page}&mode=all&lang=zh`;
    const res = await fetchImpl(url, { headers: pixivHeaders(cookie) });
    if (res.ok) {
      const json = (await res.json()) as {
        error?: boolean;
        body?: { thumbnails?: { illust?: PixivSearchIllust[] } };
      };
      const works = json.body?.thumbnails?.illust || [];
      if (!json.error && works.length > 0) {
        const items: GallerySummary[] = works.map((w) => ({
          gid: String(w.id),
          token: 'pixiv',
          title: w.title || 'Untitled',
          category: 'Pixiv',
          thumb: w.url,
          posted: (w.createDate || '').slice(0, 10),
          uploader: w.userName || 'Pixiv Artist',
          rating: 4.8,
          pages: Number(w.pageCount) || 1,
          tags: (w.tags || []).slice(0, 6),
          site: 'pixiv',
        }));
        return {
          items,
          nextCursor: String(page + 1),
          prevCursor: page > 1 ? String(page - 1) : null,
          totalText: `Pixiv 关注画师新作 · 第 ${page} 页`,
          source: 'pixiv',
        };
      }
    }
  }

  // 4. Rankings (works even without login!)
  const mode = tab === 'popular' ? 'weekly' : tab === 'watched' ? 'monthly' : 'daily';
  const modeLabel = mode === 'weekly' ? '每周排行' : mode === 'monthly' ? '每月排行' : '每日排行';
  const url = `${PIXIV_BASE}/ranking.php?mode=${mode}&p=${page}&format=json`;
  const res = await fetchImpl(url, { headers: pixivHeaders(cookie) });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error(
        'Pixiv 拒绝了当前云端节点访问 (HTTP 403)。请在顶部站点弹窗中导入 Pixiv 的 PHPSESSID Cookie，或使用本地 Node / 自托管后端访问。'
      );
    }
    throw new Error(`Pixiv 排行榜获取失败 (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    contents?: PixivRankingItem[];
    next?: number | false;
    prev?: number | false;
    date?: string;
  };
  const contents = json.contents || [];
  const items: GallerySummary[] = contents.map((c) => ({
    gid: String(c.illust_id),
    token: 'pixiv',
    title: c.title || 'Untitled',
    category: 'Pixiv',
    thumb: c.url,
    posted: c.date || '',
    uploader: c.user_name || 'Pixiv Artist',
    rating: c.rating_count ? Math.min(5, 4.2 + Math.log10(c.rating_count + 1) * 0.2) : 4.7,
    pages: Number(c.illust_page_count) || 1,
    tags: (c.tags || []).slice(0, 6),
    site: 'pixiv',
  }));

  return {
    items,
    nextCursor: json.next ? String(json.next) : null,
    prevCursor: json.prev ? String(json.prev) : null,
    totalText: `Pixiv ${modeLabel}${json.date ? ` (${json.date})` : ''}`,
    source: 'pixiv',
  };
}

export async function pixivFetchDetail(
  illustId: string,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<GalleryDetail> {
  const [infoRes, pagesRes] = await Promise.all([
    fetchImpl(`${PIXIV_BASE}/ajax/illust/${illustId}?lang=zh`, { headers: pixivHeaders(cookie) }),
    fetchImpl(`${PIXIV_BASE}/ajax/illust/${illustId}/pages?lang=zh`, {
      headers: pixivHeaders(cookie),
    }),
  ]);

  if (!infoRes.ok) throw new Error(`Pixiv 作品详情获取失败 (HTTP ${infoRes.status})`);
  const infoJson = (await infoRes.json()) as {
    error?: boolean;
    message?: string;
    body?: {
      illustId: string;
      illustTitle: string;
      illustComment?: string;
      userName: string;
      createDate: string;
      pageCount: number;
      bookmarkCount: number;
      likeCount: number;
      viewCount: number;
      urls?: { regular?: string; small?: string; original?: string };
      tags?: {
        tags?: Array<{ tag: string; translation?: { en?: string; zh?: string } }>;
      };
    };
  };
  if (infoJson.error || !infoJson.body) {
    throw new Error(infoJson.message || '无法加载该 Pixiv 作品（可能是 R-18 作品需要导入 PHPSESSID）');
  }

  const body = infoJson.body;
  let previews: GalleryPreviewPage[] = [];

  if (pagesRes.ok) {
    const pagesJson = (await pagesRes.json()) as {
      error?: boolean;
      body?: Array<{
        urls?: { thumb_mini?: string; small?: string; regular?: string; original?: string };
      }>;
    };
    if (!pagesJson.error && Array.isArray(pagesJson.body)) {
      previews = pagesJson.body.map((p, idx) => ({
        page: idx + 1,
        pageToken: `px${idx + 1}`,
        thumbUrl: p.urls?.small || p.urls?.regular || body.urls?.small || '',
        directImageUrl: p.urls?.regular || p.urls?.original || p.urls?.small || '',
      }));
    }
  }

  if (previews.length === 0 && body.urls?.regular) {
    previews = [
      {
        page: 1,
        pageToken: 'px1',
        thumbUrl: body.urls.small || body.urls.regular,
        directImageUrl: body.urls.regular || body.urls.original || '',
      },
    ];
  }

  const rawTags = body.tags?.tags || [];
  const tagStrings = rawTags.map((t) =>
    t.translation?.zh ? `${t.tag} (${t.translation.zh})` : t.tag
  );

  return {
    gid: String(body.illustId || illustId),
    token: 'pixiv',
    title: body.illustTitle || 'Untitled',
    titleJpn: '',
    category: 'Pixiv',
    thumb: body.urls?.regular || body.urls?.small || previews[0]?.thumbUrl || '',
    uploader: body.userName || 'Pixiv Artist',
    posted: (body.createDate || '').replace('T', ' ').slice(0, 16),
    visible: 'Yes',
    language: 'Pixiv',
    fileSize: `${body.viewCount || 0} 浏览`,
    pages: body.pageCount || previews.length,
    favoritedCount: body.bookmarkCount || 0,
    rating: 4.9,
    ratingCount: body.likeCount || 0,
    tagGroups: tagStrings.length > 0 ? [{ namespace: 'pixiv', tags: tagStrings }] : [],
    previews,
    previewPageCount: 1,
    currentPreviewPage: 0,
    comments: body.illustComment
      ? [
          {
            id: 'pixiv-desc',
            author: body.userName || '画师简介',
            postedAt: (body.createDate || '').slice(0, 10),
            score: `${body.likeCount || 0} 赞`,
            isUploader: true,
            html: body.illustComment,
            text: body.illustComment.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''),
          },
        ]
      : [],
    source: 'pixiv',
  };
}

export async function pixivAddBookmark(
  illustId: string,
  cookie: string | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<{ ok: boolean; message: string }> {
  if (!extractPixivUserId(cookie)) {
    throw new Error('请先在设置中导入 Pixiv 的 PHPSESSID Cookie');
  }

  // Fetch CSRF token from artwork HTML page
  const pageRes = await fetchImpl(`${PIXIV_BASE}/artworks/${illustId}`, {
    headers: {
      ...pixivHeaders(cookie),
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
  });
  const html = await pageRes.text();
  const tokenMatch =
    html.match(/"token"\s*:\s*"([a-f0-9]+)"/i) || html.match(/token&quot;:&quot;([a-f0-9]+)&quot;/i);
  if (!tokenMatch) {
    throw new Error('无法获取 Pixiv CSRF Token，请检查 PHPSESSID 是否有效');
  }

  const res = await fetchImpl(`${PIXIV_BASE}/ajax/illusts/bookmarks/add`, {
    method: 'POST',
    headers: {
      ...pixivHeaders(cookie),
      'Content-Type': 'application/json; charset=utf-8',
      'x-csrf-token': tokenMatch[1],
      Origin: PIXIV_BASE,
    },
    body: JSON.stringify({
      illust_id: String(illustId),
      restrict: 0,
      comment: '',
      tags: [],
    }),
  });

  const json = (await res.json().catch(() => ({}))) as { error?: boolean; message?: string };
  if (!res.ok || json.error) {
    throw new Error(json.message || `Pixiv 收藏失败 (HTTP ${res.status})`);
  }
  return { ok: true, message: '已同步收藏到你的 Pixiv 账号！' };
}
