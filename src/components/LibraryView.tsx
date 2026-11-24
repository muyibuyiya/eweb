import React, { useEffect, useState } from 'react';
import { Clock, Cloud, Heart, RefreshCw, Trash2 } from 'lucide-react';
import type {
  AppSettings,
  GallerySummary,
  ReadingHistoryItem,
  ViewLayout,
} from '../../shared/types';
import { fetchGalleries } from '../lib/api';
import { GalleryCard } from './GalleryCard';

interface LibraryViewProps {
  favorites: GallerySummary[];
  history: ReadingHistoryItem[];
  settings: AppSettings;
  layout: ViewLayout;
  onSelectGallery: (gallery: GallerySummary) => void;
  onToggleFavorite: (gallery: GallerySummary, e?: React.MouseEvent) => void;
  onClearHistory: () => void;
}

type LibraryTab = 'favorites' | 'history' | 'remote';

export const LibraryView: React.FC<LibraryViewProps> = ({
  favorites,
  history,
  settings,
  layout,
  onSelectGallery,
  onToggleFavorite,
  onClearHistory,
}) => {
  const [tab, setTab] = useState<LibraryTab>('favorites');
  const [remoteFavs, setRemoteFavs] = useState<GallerySummary[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  const favIdSet = new Set(favorites.map((f) => f.gid));
  const historyMap = new Map(history.map((h) => [h.gallery.gid, h]));

  const loadRemoteFavorites = async () => {
    setRemoteLoading(true);
    setRemoteError(null);
    try {
      const data = await fetchGalleries({ tab: 'favorites' }, settings);
      setRemoteFavs(data.items);
    } catch (err) {
      setRemoteError(err instanceof Error ? err.message : '加载账号收藏失败');
    } finally {
      setRemoteLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'remote') {
      loadRemoteFavorites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, settings.site, settings.cookie, settings.demoMode]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-28 pt-3">
      {/* iOS Segmented Control */}
      <div
        className="grid grid-cols-3 rounded-xl p-1 text-[13px] font-semibold"
        style={{ background: 'var(--bg-chip)' }}
      >
        {(
          [
            { id: 'favorites', label: `本地收藏 (${favorites.length})`, icon: Heart },
            { id: 'history', label: `历史 (${history.length})`, icon: Clock },
            { id: 'remote', label: '云端收藏', icon: Cloud },
          ] as const
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="rounded-lg py-1.5 transition-all"
              style={{
                background: active ? 'var(--bg-secondary)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'favorites' && (
        <div className="mt-4">
          {favorites.length === 0 ? (
            <div className="ios-card flex flex-col items-center rounded-2xl py-16 text-center">
              <Heart className="h-10 w-10 opacity-25" />
              <p className="mt-3 text-[15px] font-semibold">还没有本地收藏</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                点击画廊卡片右上角的爱心，无需登录即可收藏
              </p>
            </div>
          ) : (
            <div
              className={
                layout === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
                  : 'flex flex-col gap-2.5'
              }
            >
              {favorites.map((g) => {
                const h = historyMap.get(g.gid);
                return (
                  <GalleryCard
                    key={g.gid}
                    gallery={g}
                    layout={layout}
                    isFavorite={true}
                    translateTags={settings.translateTags}
                    progress={h ? { lastPage: h.lastPage, totalPages: h.totalPages } : undefined}
                    onSelect={onSelectGallery}
                    onToggleFavorite={onToggleFavorite}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-4">
          {history.length > 0 && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-rose-500"
                style={{ background: 'var(--bg-chip)' }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空历史
              </button>
            </div>
          )}

          {history.length === 0 ? (
            <div className="ios-card flex flex-col items-center rounded-2xl py-16 text-center">
              <Clock className="h-10 w-10 opacity-25" />
              <p className="mt-3 text-[15px] font-semibold">暂无阅读记录</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                打开画廊阅读后，这里会自动记住你上次读到的页码
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {history.map((item) => (
                <GalleryCard
                  key={item.gallery.gid}
                  gallery={item.gallery}
                  layout="list"
                  isFavorite={favIdSet.has(item.gallery.gid)}
                  translateTags={settings.translateTags}
                  progress={{ lastPage: item.lastPage, totalPages: item.totalPages }}
                  onSelect={onSelectGallery}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'remote' && (
        <div className="mt-4">
          {!(
            settings.site === 'pixiv'
              ? settings.pixivCookie
              : settings.site === 'jmcomic'
                ? settings.jmCookie
                : settings.cookie
          ) && !settings.demoMode ? (
            <div className="ios-card flex flex-col items-center rounded-2xl px-6 py-14 text-center">
              <Cloud className="h-10 w-10 opacity-25" />
              <p className="mt-3 text-[15px] font-semibold">需要配置 Cookie</p>
              <p className="mt-1 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                请前往「设置」填入你的 E-Hentai Cookie 后，即可同步查看账号收藏夹。
              </p>
            </div>
          ) : remoteLoading ? (
            <div className="ios-card flex flex-col items-center rounded-2xl py-14">
              <RefreshCw className="h-6 w-6 animate-spin opacity-60" />
              <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                正在获取云端收藏...
              </p>
            </div>
          ) : remoteError ? (
            <div className="ios-card rounded-2xl p-6 text-center">
              <p className="text-sm text-rose-500">{remoteError}</p>
              <button
                type="button"
                onClick={loadRemoteFavorites}
                className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                重试
              </button>
            </div>
          ) : (
            <div
              className={
                layout === 'grid'
                  ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'
                  : 'flex flex-col gap-2.5'
              }
            >
              {remoteFavs.map((g) => {
                const h = historyMap.get(g.gid);
                return (
                  <GalleryCard
                    key={g.gid}
                    gallery={g}
                    layout={layout}
                    isFavorite={favIdSet.has(g.gid)}
                    translateTags={settings.translateTags}
                    progress={h ? { lastPage: h.lastPage, totalPages: h.totalPages } : undefined}
                    onSelect={onSelectGallery}
                    onToggleFavorite={onToggleFavorite}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
