import React from 'react';
import { BookOpen, Heart, Star } from 'lucide-react';
import {
  CATEGORY_COLOR_MAP,
  type GallerySummary,
  type ViewLayout,
} from '../../shared/types';
import { buildImageUrl } from '../lib/api';
import {
  translateCategory,
  translateFullTag,
  translateLanguageLabel,
} from '../lib/tagTranslation';

interface GalleryCardProps {
  gallery: GallerySummary;
  layout: ViewLayout;
  isFavorite: boolean;
  translateTags?: boolean;
  progress?: { lastPage: number; totalPages: number };
  onSelect: (gallery: GallerySummary) => void;
  onToggleFavorite?: (gallery: GallerySummary, e: React.MouseEvent) => void;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({
  gallery,
  layout,
  isFavorite,
  translateTags = true,
  progress,
  onSelect,
  onToggleFavorite,
}) => {
  const catColor = CATEGORY_COLOR_MAP[gallery.category.toLowerCase()] || '#9E9E9E';
  const catLabel = translateCategory(gallery.category, translateTags);
  const langLabel = translateLanguageLabel(gallery.language, translateTags);
  const coverUrl = buildImageUrl(gallery.thumb);
  const progressPct =
    progress && progress.totalPages > 0
      ? Math.min(100, Math.round((progress.lastPage / progress.totalPages) * 100))
      : 0;

  if (layout === 'list') {
    return (
      <div
        onClick={() => onSelect(gallery)}
        role="button"
        tabIndex={0}
        className="ios-card group flex gap-3 rounded-2xl p-2.5 active:scale-[0.985] transition-transform cursor-pointer shadow-xs"
      >
        <div className="relative w-24 h-34 shrink-0 overflow-hidden rounded-xl bg-black/10">
          {coverUrl && (
            <img
              src={coverUrl}
              alt={gallery.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
          <span
            className="absolute top-1.5 left-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
            style={{ backgroundColor: catColor }}
          >
            {catLabel}
          </span>
          {progressPct > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
              <div className="h-full bg-indigo-400" style={{ width: `${progressPct}%` }} />
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
          <div>
            <h3 className="line-clamp-2 text-[14px] font-semibold leading-snug">
              {gallery.title}
            </h3>
            <p className="mt-1 truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {gallery.uploader}
              {gallery.posted ? ` · ${gallery.posted}` : ''}
            </p>
            {gallery.tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {gallery.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    title={tag}
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium truncate max-w-[120px]"
                    style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)' }}
                  >
                    {translateTags
                      ? translateFullTag(tag, true)
                      : tag.includes(':')
                        ? tag.split(':')[1]
                        : tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
              <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {gallery.rating.toFixed(1)}
              </span>
              {gallery.pages > 0 && (
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="h-3.5 w-3.5" />
                  {gallery.pages}P
                </span>
              )}
              {langLabel && (
                <span className="text-[10px] font-semibold opacity-80">
                  {langLabel}
                </span>
              )}
            </div>

            {onToggleFavorite && (
              <button
                type="button"
                aria-label="收藏"
                onClick={(e) => onToggleFavorite(gallery, e)}
                className="p-1.5 -mr-1 rounded-full active:scale-90 transition-transform"
              >
                <Heart
                  className={`h-4 w-4 ${
                    isFavorite ? 'fill-rose-500 text-rose-500' : 'text-neutral-400'
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(gallery)}
      role="button"
      tabIndex={0}
      className="ios-card group flex flex-col overflow-hidden rounded-2xl active:scale-[0.975] transition-transform cursor-pointer shadow-xs"
    >
      <div className="relative aspect-[3/4.2] w-full overflow-hidden bg-black/10">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={gallery.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/55 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent" />

        <span
          className="absolute top-2 left-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-tight text-white shadow-sm"
          style={{ backgroundColor: catColor }}
        >
          {catLabel}
        </span>

        {onToggleFavorite && (
          <button
            type="button"
            aria-label="收藏"
            onClick={(e) => onToggleFavorite(gallery, e)}
            className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 backdrop-blur-md active:scale-90 transition-transform"
          >
            <Heart
              className={`h-3.5 w-3.5 ${
                isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white/90'
              }`}
            />
          </button>
        )}

        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-semibold text-white">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-md">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {gallery.rating.toFixed(1)}
          </span>
          {gallery.pages > 0 && (
            <span className="rounded-full bg-black/45 px-2 py-0.5 backdrop-blur-md">
              {gallery.pages}P
            </span>
          )}
        </div>

        {progressPct > 0 && (
          <div className="absolute bottom-0 inset-x-0 h-1 bg-black/40">
            <div className="h-full bg-indigo-400" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-2.5">
        <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug">{gallery.title}</h3>
        <div
          className="mt-1.5 flex items-center justify-between gap-1 text-[11px]"
          style={{ color: 'var(--text-secondary)' }}
        >
          <span className="truncate">{gallery.uploader}</span>
          {langLabel && (
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style={{ background: 'var(--bg-chip)' }}
            >
              {langLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
