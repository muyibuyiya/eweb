import React, { useCallback, useEffect, useState } from 'react';
import {
  Bookmark,
  ChevronDown,
  Compass,
  Flame,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  EhSite,
  GalleryDetail,
  GallerySummary,
  ReadingHistoryItem,
  ReadingMode,
} from '../shared/types';
import {
  loadFavorites,
  loadHistory,
  loadSearchHistory,
  loadSettings,
  saveFavorites,
  saveHistory,
  saveSearchHistory,
  saveSettings,
} from './lib/storage';
import { fetchGalleries, syncSession } from './lib/api';
import { initTagTranslationCache, subscribeTagDb } from './lib/tagTranslation';
import { GalleryCard } from './components/GalleryCard';
import { CategoryFilterSheet } from './components/CategoryFilterSheet';
import { GalleryDetailView } from './components/GalleryDetailView';
import { ReaderView } from './components/ReaderView';
import { LibraryView } from './components/LibraryView';
import { SettingsView } from './components/SettingsView';
import { SITE_META, SiteSwitcherSheet } from './components/SiteSwitcherSheet';
import { CookieGuideModal } from './components/CookieGuideModal';

type RootTab = 'discover' | 'library' | 'settings';
type FeedTab = 'front' | 'popular' | 'watched';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [favorites, setFavorites] = useState<GallerySummary[]>(() => loadFavorites());
  const [history, setHistory] = useState<ReadingHistoryItem[]>(() => loadHistory());
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadSearchHistory());

  const [rootTab, setRootTab] = useState<RootTab>('discover');
  const [feedTab, setFeedTab] = useState<FeedTab>('front');
  const [searchInput, setSearchInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [excludedCatsMask, setExcludedCatsMask] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [siteSwitcherOpen, setSiteSwitcherOpen] = useState(false);
  const [cookieGuideSite, setCookieGuideSite] = useState<EhSite | null>(null);

  const [galleries, setGalleries] = useState<GallerySummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [totalText, setTotalText] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedGallery, setSelectedGallery] = useState<GallerySummary | null>(null);
  const [readerState, setReaderState] = useState<{
    detail: GalleryDetail;
    startPage: number;
  } | null>(null);
  const [, setTagDbTick] = useState(0);

  // Load cached EhTagTranslation DB from IndexedDB on startup
  useEffect(() => {
    initTagTranslationCache();
    return subscribeTagDb(() => setTagDbTick((t) => t + 1));
  }, []);

  // Apply theme to <html>
  useEffect(() => {
    const apply = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effective =
        settings.theme === 'system' ? (prefersDark ? 'dark' : 'light') : settings.theme;
      if (effective === 'light') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', effective);
      }
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [settings.theme]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const loadFeed = useCallback(
    async (opts?: { append?: boolean; cursor?: string | null }) => {
      const isAppend = Boolean(opts?.append);
      if (isAppend) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        await syncSession(settings);
        const data = await fetchGalleries(
          {
            tab: feedTab,
            query: activeQuery,
            fCats: excludedCatsMask,
            next: opts?.cursor || undefined,
          },
          settings
        );

        setGalleries((prev) => {
          if (!isAppend) return data.items;
          const seen = new Set(prev.map((g) => g.gid));
          return [...prev, ...data.items.filter((g) => !seen.has(g.gid))];
        });
        setNextCursor(data.nextCursor);
        setTotalText(data.totalText);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeQuery, excludedCatsMask, feedTab, settings]
  );

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleSubmitSearch = (query: string) => {
    const trimmed = query.trim();
    setSearchInput(trimmed);
    setActiveQuery(trimmed);
    setSearchFocused(false);
    setSelectedGallery(null);
    setRootTab('discover');
    if (trimmed) {
      setSearchHistory((prev) => {
        const next = [trimmed, ...prev.filter((q) => q !== trimmed)].slice(0, 15);
        saveSearchHistory(next);
        return next;
      });
    }
  };

  const toggleFavorite = useCallback((gallery: GallerySummary, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFavorites((prev) => {
      const exists = prev.some((f) => f.gid === gallery.gid);
      const next = exists ? prev.filter((f) => f.gid !== gallery.gid) : [gallery, ...prev];
      saveFavorites(next);
      return next;
    });
  }, []);

  const recordProgress = useCallback((gallery: GallerySummary, page: number, totalPages: number) => {
    setHistory((prev) => {
      const next: ReadingHistoryItem[] = [
        { gallery, lastPage: page, totalPages, updatedAt: Date.now() },
        ...prev.filter((h) => h.gallery.gid !== gallery.gid),
      ];
      saveHistory(next);
      return next;
    });
  }, []);

  const handleClearHistory = () => {
    setHistory([]);
    saveHistory([]);
  };

  const favIdSet = new Set(favorites.map((f) => f.gid));
  const historyMap = new Map(history.map((h) => [h.gallery.gid, h]));

  // Full-screen Reader View
  if (readerState) {
    const summaryForHistory: GallerySummary = selectedGallery || {
      gid: readerState.detail.gid,
      token: readerState.detail.token,
      title: readerState.detail.title,
      category: readerState.detail.category,
      thumb: readerState.detail.thumb,
      posted: readerState.detail.posted,
      uploader: readerState.detail.uploader,
      rating: readerState.detail.rating,
      pages: readerState.detail.pages,
      tags: [],
      language: readerState.detail.language,
    };

    return (
      <ReaderView
        detail={readerState.detail}
        initialPage={readerState.startPage}
        settings={settings}
        onChangeReadingMode={(m: ReadingMode) => updateSettings({ readingMode: m })}
        onProgressChange={(page) =>
          recordProgress(summaryForHistory, page, readerState.detail.pages)
        }
        onClose={() => setReaderState(null)}
      />
    );
  }

  // Gallery Detail View
  if (selectedGallery) {
    const h = historyMap.get(selectedGallery.gid);
    return (
      <GalleryDetailView
        summary={selectedGallery}
        settings={settings}
        isFavorite={favIdSet.has(selectedGallery.gid)}
        lastReadPage={h?.lastPage}
        onBack={() => setSelectedGallery(null)}
        onToggleFavorite={(g) => toggleFavorite(g)}
        onSearchTag={(tagQuery) => handleSubmitSearch(tagQuery)}
        onOpenReader={(detail, startPage) => setReaderState({ detail, startPage })}
      />
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Top iOS Frosted Header */}
      <header
        className="ios-glass safe-pt sticky top-0 z-30 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="mx-auto max-w-4xl px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-extrabold tracking-tight">
                {rootTab === 'discover'
                  ? 'EhWeb'
                  : rootTab === 'library'
                    ? '书架'
                    : '设置'}
              </h1>
              {settings.demoMode ? (
                <button
                  type="button"
                  onClick={() => setSiteSwitcherOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-[11px] font-semibold text-indigo-400 active:scale-95 transition-transform"
                >
                  演示模式
                  <ChevronDown className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSiteSwitcherOpen(true)}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow-xs active:scale-95 transition-transform"
                  style={{ backgroundColor: SITE_META[settings.site].badgeColor }}
                >
                  {SITE_META[settings.site].name}
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>

            {rootTab !== 'settings' && (
              <div className="flex items-center gap-1.5">
                {rootTab === 'discover' && (
                  <>
                    {(settings.site === 'e-hentai' || settings.site === 'exhentai') && (
                      <button
                        type="button"
                        onClick={() => setFilterOpen(true)}
                        className="relative flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
                        style={{
                          background:
                            excludedCatsMask > 0 ? 'var(--accent-soft)' : 'var(--bg-chip)',
                          color: excludedCatsMask > 0 ? 'var(--accent)' : 'var(--text-primary)',
                        }}
                        aria-label="分类筛选"
                      >
                        <SlidersHorizontal className="h-4.5 w-4.5" />
                        {excludedCatsMask > 0 && (
                          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-500" />
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => loadFeed()}
                      className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
                      style={{ background: 'var(--bg-chip)' }}
                      aria-label="刷新"
                    >
                      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() =>
                    updateSettings({
                      viewLayout: settings.viewLayout === 'grid' ? 'list' : 'grid',
                    })
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
                  style={{ background: 'var(--bg-chip)' }}
                  aria-label="切换视图"
                >
                  {settings.viewLayout === 'grid' ? (
                    <List className="h-4.5 w-4.5" />
                  ) : (
                    <LayoutGrid className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Search Bar & Feed Tabs (Discover only) */}
          {rootTab === 'discover' && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitSearch(searchInput);
                }}
                className="relative mt-2.5"
              >
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                  style={{ color: 'var(--text-secondary)' }}
                />
                <input
                  type="search"
                  value={searchInput}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={
                    settings.site === 'pixiv'
                      ? '搜索 Pixiv 插画 / 漫画标签（如 原神、碧蓝档案）'
                      : settings.site === 'jmcomic'
                        ? '搜索禁漫标题、作者或车牌号（JM 号）'
                        : '搜索标题、画师或标签（如 language:chinese$）'
                  }
                  className="w-full rounded-xl py-2 pr-9 pl-9 text-[14px] outline-none"
                  style={{ background: 'var(--bg-chip)' }}
                />
                {(searchInput || activeQuery) && (
                  <button
                    type="button"
                    onClick={() => handleSubmitSearch('')}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-0.5 opacity-60 hover:opacity-100"
                    aria-label="清空搜索"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {/* Search History Dropdown */}
                {searchFocused && searchHistory.length > 0 && (
                  <div
                    className="ios-card absolute top-full right-0 left-0 z-40 mt-1.5 rounded-2xl p-3 shadow-xl"
                    style={{ background: 'var(--bg-secondary)' }}
                  >
                    <div className="mb-2 flex items-center justify-between text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      <span>最近搜索</span>
                      <button
                        type="button"
                        onMouseDown={() => {
                          setSearchHistory([]);
                          saveSearchHistory([]);
                        }}
                        className="text-rose-500"
                      >
                        清除
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onMouseDown={() => handleSubmitSearch(q)}
                          className="rounded-lg px-2.5 py-1 text-[12px] font-medium"
                          style={{ background: 'var(--bg-chip)' }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </form>

              <div className="no-scrollbar mt-2.5 flex items-center gap-2 overflow-x-auto pb-0.5">
                {(
                  settings.site === 'pixiv'
                    ? ([
                        { id: 'front', label: '每日排行', icon: Compass },
                        { id: 'popular', label: '每周排行', icon: Flame },
                        { id: 'watched', label: '每月 / 关注', icon: Sparkles },
                      ] as const)
                    : settings.site === 'jmcomic'
                      ? ([
                          { id: 'front', label: '最新漫画', icon: Compass },
                          { id: 'popular', label: '热门排行', icon: Flame },
                          { id: 'watched', label: '最多收藏', icon: Sparkles },
                        ] as const)
                      : ([
                          { id: 'front', label: '最新画廊', icon: Compass },
                          { id: 'popular', label: '热门精选', icon: Flame },
                          { id: 'watched', label: '订阅关注', icon: Sparkles },
                        ] as const)
                ).map((item) => {
                  const Icon = item.icon;
                  const active = feedTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFeedTab(item.id)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all active:scale-95"
                      style={{
                        background: active ? 'var(--accent)' : 'var(--bg-chip)',
                        color: active ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {rootTab === 'discover' && (
          <div className="mx-auto max-w-4xl px-4 pb-28 pt-3">
            {totalText && !error && (
              <div
                className="mb-2.5 flex items-center justify-between text-[12px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span>{totalText}</span>
                {activeQuery && (
                  <span className="truncate max-w-[55%]">关键词：{activeQuery}</span>
                )}
              </div>
            )}

            {error && (
              <div className="ios-card mb-4 rounded-2xl p-5 text-center">
                <p className="text-[14px] font-medium text-rose-500">{error}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => loadFeed()}
                    className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white active:scale-95"
                    style={{ background: 'var(--accent)' }}
                  >
                    重新连接
                  </button>
                  {!settings.demoMode && (
                    <button
                      type="button"
                      onClick={() => updateSettings({ demoMode: true })}
                      className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-semibold active:scale-95"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                    >
                      <Sparkles className="h-4 w-4" />
                      开启演示模式体验界面
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRootTab('settings')}
                    className="rounded-xl px-4 py-2 text-[13px] font-semibold active:scale-95"
                    style={{ background: 'var(--bg-chip)' }}
                  >
                    配置代理 / Cookie
                  </button>
                </div>
              </div>
            )}

            {loading && galleries.length === 0 ? (
              <div
                className={
                  settings.viewLayout === 'grid'
                    ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
                    : 'flex flex-col gap-2.5'
                }
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`ios-card animate-pulse rounded-2xl ${
                      settings.viewLayout === 'grid' ? 'aspect-[3/4.8]' : 'h-36'
                    }`}
                  />
                ))}
              </div>
            ) : galleries.length === 0 && !error ? (
              <div className="ios-card rounded-2xl py-16 text-center">
                <p className="text-[15px] font-semibold">没有找到匹配的画廊</p>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  试试更换关键词或调整分类筛选
                </p>
              </div>
            ) : (
              <>
                <div
                  className={
                    settings.viewLayout === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
                      : 'flex flex-col gap-2.5'
                  }
                >
                  {galleries.map((g) => {
                    const h = historyMap.get(g.gid);
                    return (
                      <GalleryCard
                        key={g.gid}
                        gallery={g}
                        layout={settings.viewLayout}
                        isFavorite={favIdSet.has(g.gid)}
                        translateTags={settings.translateTags}
                        progress={
                          h ? { lastPage: h.lastPage, totalPages: h.totalPages } : undefined
                        }
                        onSelect={setSelectedGallery}
                        onToggleFavorite={toggleFavorite}
                      />
                    );
                  })}
                </div>

                {nextCursor && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => loadFeed({ append: true, cursor: nextCursor })}
                      className="ios-card inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-[14px] font-semibold active:scale-95 disabled:opacity-60"
                    >
                      {loadingMore && <RefreshCw className="h-4 w-4 animate-spin" />}
                      {loadingMore ? '正在加载更多...' : '加载下一页'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {rootTab === 'library' && (
          <LibraryView
            favorites={favorites}
            history={history}
            settings={settings}
            layout={settings.viewLayout}
            onSelectGallery={setSelectedGallery}
            onToggleFavorite={toggleFavorite}
            onClearHistory={handleClearHistory}
          />
        )}

        {rootTab === 'settings' && (
          <SettingsView
            settings={settings}
            onUpdate={updateSettings}
            onOpenCookieGuide={() => setCookieGuideSite(settings.site)}
          />
        )}
      </main>

      {/* Bottom iOS Frosted Tab Bar */}
      <nav
        className="ios-glass safe-pb fixed right-0 bottom-0 left-0 z-30 border-t"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="mx-auto grid max-w-lg grid-cols-3 py-1.5">
          {(
            [
              { id: 'discover', label: '探索', icon: Compass },
              { id: 'library', label: '书架', icon: Bookmark },
              { id: 'settings', label: '设置', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = rootTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRootTab(item.id)}
                className="flex flex-col items-center justify-center gap-0.5 py-1 active:scale-90 transition-transform"
                style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                <Icon className="h-5.5 w-5.5" strokeWidth={active ? 2.4 : 1.9} />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Category Filter Bottom Sheet */}
      <CategoryFilterSheet
        open={filterOpen}
        excludedMask={excludedCatsMask}
        onChangeMask={setExcludedCatsMask}
        onQuickTag={handleSubmitSearch}
        onClose={() => setFilterOpen(false)}
      />

      {/* Multi-Site Switcher Bottom Sheet */}
      <SiteSwitcherSheet
        open={siteSwitcherOpen}
        settings={settings}
        onSelectSite={(site) => {
          setGalleries([]);
          setActiveQuery('');
          setSearchInput('');
          setFeedTab('front');
          updateSettings({ site, demoMode: false });
        }}
        onOpenCookieGuide={(site) => setCookieGuideSite(site)}
        onClose={() => setSiteSwitcherOpen(false)}
      />

      {/* Account Login & Cookie Import Guide Modal */}
      <CookieGuideModal
        open={cookieGuideSite !== null}
        initialSite={cookieGuideSite || settings.site}
        settings={settings}
        onUpdateSettings={updateSettings}
        onClose={() => setCookieGuideSite(null)}
      />
    </div>
  );
}
