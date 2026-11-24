import type {
  AppSettings,
  EhSite,
  GalleryDetail,
  GalleryListResponse,
  GalleryPreviewPage,
  ReaderImageResponse,
} from '../../shared/types';

let currentSid: string | null = null;
let currentApiBase = '';

function apiUrl(path: string, settings?: AppSettings): string {
  const base = (settings?.apiBaseUrl ?? currentApiBase).trim().replace(/\/+$/, '');
  return base ? `${base}${path}` : path;
}

export async function syncSession(settings: AppSettings): Promise<string | null> {
  currentApiBase = settings.apiBaseUrl.trim().replace(/\/+$/, '');
  if (settings.demoMode) return null;
  try {
    const res = await fetch(apiUrl('/api/session', settings), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sid: currentSid || undefined,
        site: settings.site,
        cookie: settings.cookie || undefined,
        pixivCookie: settings.pixivCookie || undefined,
        jmCookie: settings.jmCookie || undefined,
        jmDomain: settings.jmDomain || undefined,
        proxyUrl: settings.proxyUrl || undefined,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { sid: string };
    currentSid = data.sid;
    return currentSid;
  } catch {
    return null;
  }
}

export function getCurrentSid(): string | null {
  return currentSid;
}

export function buildImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
  if (rawUrl.startsWith('/api/')) return apiUrl(rawUrl);
  const params = new URLSearchParams({ url: rawUrl });
  if (currentSid) params.set('sid', currentSid);
  return apiUrl(`/api/proxy-image?${params.toString()}`);
}

function buildHeaders(settings: AppSettings, siteOverride?: EhSite): Record<string, string> {
  const headers: Record<string, string> = {
    'x-eh-site': siteOverride || settings.site,
  };
  if (currentSid) headers['x-eh-sid'] = currentSid;
  if (settings.cookie) headers['x-eh-cookie'] = settings.cookie;
  if (settings.pixivCookie) headers['x-pixiv-cookie'] = settings.pixivCookie;
  if (settings.jmCookie) headers['x-jm-cookie'] = settings.jmCookie;
  if (settings.jmDomain) headers['x-jm-domain'] = settings.jmDomain;
  if (settings.proxyUrl) headers['x-eh-proxy'] = settings.proxyUrl;
  return headers;
}

async function requestJson<T>(
  path: string,
  settings: AppSettings,
  options?: { method?: string; body?: unknown; siteOverride?: EhSite }
): Promise<T> {
  const res = await fetch(apiUrl(path, settings), {
    method: options?.method || 'GET',
    headers: {
      ...buildHeaders(settings, options?.siteOverride),
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `请求失败 (HTTP ${res.status})`);
  }
  return body as T;
}

export interface FetchGalleriesParams {
  tab: 'front' | 'popular' | 'watched' | 'favorites';
  query?: string;
  fCats?: number;
  next?: string;
  prev?: string;
}

export async function fetchGalleries(
  params: FetchGalleriesParams,
  settings: AppSettings
): Promise<GalleryListResponse> {
  const sp = new URLSearchParams({ tab: params.tab });
  if (params.query) sp.set('q', params.query);
  if (params.fCats && params.fCats > 0) sp.set('f_cats', String(params.fCats));
  if (params.next) sp.set('next', params.next);
  if (params.prev) sp.set('prev', params.prev);
  if (settings.demoMode) sp.set('demo', '1');
  return requestJson<GalleryListResponse>(`/api/galleries?${sp.toString()}`, settings);
}

export async function fetchGalleryDetail(
  gid: string,
  token: string,
  previewPage: number,
  settings: AppSettings,
  siteOverride?: EhSite
): Promise<GalleryDetail> {
  const sp = new URLSearchParams();
  if (previewPage > 0) sp.set('p', String(previewPage));
  if (settings.demoMode) sp.set('demo', '1');
  const qs = sp.toString() ? `?${sp.toString()}` : '';
  return requestJson<GalleryDetail>(`/api/gallery/${gid}/${token}${qs}`, settings, {
    siteOverride,
  });
}

export async function fetchJmChapter(
  photoId: string,
  settings: AppSettings
): Promise<{ photoId: string; previews: GalleryPreviewPage[] }> {
  return requestJson<{ photoId: string; previews: GalleryPreviewPage[] }>(
    `/api/jm-chapter/${photoId}`,
    settings,
    { siteOverride: 'jmcomic' }
  );
}

export async function ehOfficialLogin(
  username: string,
  password: string,
  settings: AppSettings
): Promise<{ ok: boolean; cookie: string }> {
  return requestJson<{ ok: boolean; cookie: string }>('/api/eh-login', settings, {
    method: 'POST',
    body: { username, password },
  });
}

export async function syncOfficialFavorite(
  gid: string,
  token: string,
  site: EhSite,
  settings: AppSettings
): Promise<{ ok: boolean; message: string }> {
  return requestJson<{ ok: boolean; message: string }>('/api/favorite', settings, {
    method: 'POST',
    body: { gid, token, site },
    siteOverride: site,
  });
}

export async function fetchReaderImage(
  gid: string,
  pageToken: string,
  page: number,
  settings: AppSettings,
  nl?: string
): Promise<ReaderImageResponse> {
  const sp = new URLSearchParams();
  if (nl) sp.set('nl', nl);
  if (settings.demoMode) sp.set('demo', '1');
  const qs = sp.toString() ? `?${sp.toString()}` : '';
  return requestJson<ReaderImageResponse>(`/api/image-page/${gid}/${pageToken}/${page}${qs}`, settings);
}

export interface HealthInfo {
  ok: boolean;
  port: number;
  lanUrls: string[];
  envProxyConfigured: boolean;
}

export interface TagDbResponse {
  version: string;
  count: number;
  fetchedAt: number;
  map: Record<string, string>;
}

export async function fetchTagTranslationDb(
  settings: AppSettings,
  force = false
): Promise<TagDbResponse> {
  const qs = force ? '?force=1' : '';
  return requestJson<TagDbResponse>(`/api/tag-db${qs}`, settings);
}

export async function fetchHealth(settings?: AppSettings): Promise<HealthInfo | null> {
  try {
    const res = await fetch(apiUrl('/api/health', settings));
    if (!res.ok) return null;
    return (await res.json()) as HealthInfo;
  } catch {
    return null;
  }
}
