import type { AppSettings, GallerySummary, ReadingHistoryItem } from '../../shared/types';

const KEYS = {
  SETTINGS: 'ehweb_settings_v1',
  FAVORITES: 'ehweb_favorites_v1',
  HISTORY: 'ehweb_history_v1',
  SEARCH_HISTORY: 'ehweb_search_history_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  site: 'e-hentai',
  cookie: '',
  pixivCookie: '',
  jmCookie: '',
  jmDomain: 'https://18comic.vip',
  proxyUrl: '',
  apiBaseUrl: '',
  demoMode: false,
  translateTags: true,
  theme: 'system',
  readingMode: 'vertical',
  viewLayout: 'grid',
  preloadCount: 5,
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

export function loadSettings(): AppSettings {
  return { ...DEFAULT_SETTINGS, ...readJson<Partial<AppSettings>>(KEYS.SETTINGS, {}) };
}

export function saveSettings(settings: AppSettings): void {
  writeJson(KEYS.SETTINGS, settings);
}

export function loadFavorites(): GallerySummary[] {
  return readJson<GallerySummary[]>(KEYS.FAVORITES, []);
}

export function saveFavorites(items: GallerySummary[]): void {
  writeJson(KEYS.FAVORITES, items);
}

export function loadHistory(): ReadingHistoryItem[] {
  return readJson<ReadingHistoryItem[]>(KEYS.HISTORY, []);
}

export function saveHistory(items: ReadingHistoryItem[]): void {
  writeJson(KEYS.HISTORY, items.slice(0, 120));
}

export function loadSearchHistory(): string[] {
  return readJson<string[]>(KEYS.SEARCH_HISTORY, []);
}

export function saveSearchHistory(queries: string[]): void {
  writeJson(KEYS.SEARCH_HISTORY, queries.slice(0, 20));
}
