import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  Cloud,
  ExternalLink,
  Heart,
  Layers,
  MessageSquare,
  RefreshCw,
  Star,
  Tag,
} from 'lucide-react';
import {
  CATEGORY_COLOR_MAP,
  type AppSettings,
  type GalleryChapter,
  type GalleryDetail,
  type GalleryPreviewPage,
  type GallerySummary,
} from '../../shared/types';
import {
  buildImageUrl,
  fetchGalleryDetail,
  fetchJmChapter,
  syncOfficialFavorite,
} from '../lib/api';
import {
  translateCategory,
  translateLanguageLabel,
  translateNamespace,
  translateTag,
} from '../lib/tagTranslation';

interface GalleryDetailViewProps {
  summary: GallerySummary;
  settings: AppSettings;
  isFavorite: boolean;
  lastReadPage?: number;
  onBack: () => void;
  onToggleFavorite: (gallery: GallerySummary) => void;
  onSearchTag: (tagQuery: string) => void;
  onOpenReader: (detail: GalleryDetail, startPage: number) => void;
}

const NAMESPACE_LABELS: Record<string, string> = {
  language: '语言',
  parody: '原作',
  character: '角色',
  group: '社团',
  artist: '画师',
  female: '女性',
  male: '男性',
  mixed: '混合',
  other: '其他',
  cosplayer: 'Coser',
  reclass: '分类',
  misc: '杂项',
};

const PreviewThumb: React.FC<{
  item: GalleryPreviewPage;
  onClick: () => void;
}> = ({ item, onClick }) => {
  const url = buildImageUrl(item.thumbUrl);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex flex-col items-center overflow-hidden rounded-xl border active:scale-95 transition-transform"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-secondary)' }}
    >
      <div className="flex w-full aspect-[3/4.2] items-center justify-center overflow-hidden bg-black/10">
        {item.sprite && url ? (
          <div
            style={{
              width: `${item.sprite.width}px`,
              height: `${item.sprite.height}px`,
              backgroundImage: `url("${url}")`,
              backgroundPosition: `${item.sprite.offsetX}px ${item.sprite.offsetY}px`,
              backgroundRepeat: 'no-repeat',
              transform: 'scale(0.85)',
              transformOrigin: 'center',
            }}
          />
        ) : url ? (
          <img
            src={url}
            alt={`Page ${item.page}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-xs opacity-50">P{item.page}</span>
        )}
      </div>
      <span
        className="w-full py-1 text-center text-[11px] font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {item.page}
      </span>
    </button>
  );
};

export const GalleryDetailView: React.FC<GalleryDetailViewProps> = ({
  summary,
  settings,
  isFavorite,
  lastReadPage,
  onBack,
  onToggleFavorite,
  onSearchTag,
  onOpenReader,
}) => {
  const [detail, setDetail] = useState<GalleryDetail | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [cloudFavLoading, setCloudFavLoading] = useState(false);
  const [cloudFavMsg, setCloudFavMsg] = useState<string | null>(null);
  const [chapterLoadingId, setChapterLoadingId] = useState<string | null>(null);

  const effectiveSite = summary.site || settings.site;

  const loadDetail = async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGalleryDetail(
        summary.gid,
        summary.token,
        p,
        settings,
        effectiveSite
      );
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载画廊详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCloudFavorite = async () => {
    setCloudFavLoading(true);
    setCloudFavMsg(null);
    try {
      const res = await syncOfficialFavorite(summary.gid, summary.token, effectiveSite, settings);
      setCloudFavMsg(res.message);
    } catch (err) {
      setCloudFavMsg(err instanceof Error ? err.message : '云端收藏失败');
    } finally {
      setCloudFavLoading(false);
    }
  };

  const handleOpenChapter = async (ch: GalleryChapter) => {
    if (!detail) return;
    setChapterLoadingId(ch.id);
    try {
      const res = await fetchJmChapter(ch.id, settings);
      onOpenReader(
        {
          ...detail,
          title: `${detail.title} · ${ch.title}`,
          pages: res.previews.length,
          previews: res.previews,
        },
        1
      );
    } catch (err) {
      setCloudFavMsg(err instanceof Error ? err.message : '章节加载失败');
    } finally {
      setChapterLoadingId(null);
    }
  };

  useEffect(() => {
    loadDetail(previewPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.gid, summary.token, previewPage, settings.demoMode, settings.site]);

  const catColor =
    CATEGORY_COLOR_MAP[(detail?.category || summary.category).toLowerCase()] || '#9E9E9E';
  const coverUrl = buildImageUrl(detail?.thumb || summary.thumb);
  const startPage = lastReadPage && lastReadPage > 1 ? lastReadPage : 1;

  const originalUrl =
    effectiveSite === 'pixiv'
      ? `https://www.pixiv.net/artworks/${summary.gid}`
      : effectiveSite === 'jmcomic'
        ? `${settings.jmDomain.replace(/\/+$/, '')}/album/${summary.gid}/`
        : `https://${
            effectiveSite === 'exhentai' ? 'exhentai.org' : 'e-hentai.org'
          }/g/${summary.gid}/${summary.token}/`;

  return (
    <div className="min-h-screen pb-14" style={{ background: 'var(--bg-primary)' }}>
      {/* Sticky iOS Navigation Bar */}
      <header
        className="ios-glass safe-pt sticky top-0 z-30 flex items-center justify-between border-b px-3 py-2.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[15px] font-medium active:opacity-60"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft className="h-5 w-5" />
          返回
        </button>

        <div className="flex items-center gap-1.5">
          {!settings.demoMode && effectiveSite !== 'jmcomic' && (
            <button
              type="button"
              disabled={cloudFavLoading}
              onClick={handleCloudFavorite}
              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-[12px] font-semibold active:scale-95 transition-transform"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              title="同步收藏到官网账号"
            >
              <Cloud className={`h-4 w-4 ${cloudFavLoading ? 'animate-pulse' : ''}`} />
              云端收藏
            </button>
          )}
          <button
            type="button"
            onClick={() => onToggleFavorite(summary)}
            className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
            style={{ background: 'var(--bg-chip)' }}
            aria-label="收藏"
          >
            <Heart
              className={`h-4.5 w-4.5 ${
                isFavorite ? 'fill-rose-500 text-rose-500' : ''
              }`}
            />
          </button>
          {!settings.demoMode && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
              style={{ background: 'var(--bg-chip)' }}
              aria-label="打开原网页"
            >
              <ExternalLink className="h-4.5 w-4.5" />
            </a>
          )}
        </div>
      </header>

      {/* Hero Section with Ambient Blur */}
      <div className="relative overflow-hidden px-4 pt-5 pb-6">
        {coverUrl && (
          <img
            src={coverUrl}
            alt=""
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-20 blur-2xl"
          />
        )}

        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex gap-4">
            <div className="w-32 sm:w-40 shrink-0 overflow-hidden rounded-2xl shadow-lg bg-black/20 aspect-[3/4.2]">
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt={detail?.title || summary.title}
                  className="h-full w-full object-cover"
                />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <span
                  className="inline-block rounded-md px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ backgroundColor: catColor }}
                >
                  {translateCategory(detail?.category || summary.category, settings.translateTags)}
                </span>

                <h1 className="mt-2 text-[16px] sm:text-[18px] font-bold leading-snug">
                  {detail?.title || summary.title}
                </h1>

                {detail?.titleJpn && (
                  <p
                    className="mt-1 line-clamp-2 text-[12px] leading-relaxed"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {detail.titleJpn}
                  </p>
                )}
              </div>

              <div
                className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]"
                style={{ color: 'var(--text-secondary)' }}
              >
                <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {(detail?.rating ?? summary.rating).toFixed(2)}
                  {detail?.ratingCount ? ` (${detail.ratingCount})` : ''}
                </span>
                <span>{detail?.pages ?? summary.pages} 页</span>
                {detail?.fileSize && <span>{detail.fileSize}</span>}
                {detail?.language && (
                  <span>{translateLanguageLabel(detail.language, settings.translateTags)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Primary Read CTA */}
          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              disabled={!detail || detail.previews.length === 0}
              onClick={() => detail && onOpenReader(detail, startPage)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white shadow-md active:scale-[0.98] disabled:opacity-50 transition-transform"
              style={{ background: 'var(--accent)' }}
            >
              <BookOpen className="h-4.5 w-4.5" />
              {lastReadPage && lastReadPage > 1
                ? `继续阅读 · 第 ${lastReadPage} 页`
                : '开始阅读'}
            </button>
            {lastReadPage && lastReadPage > 1 && detail && (
              <button
                type="button"
                onClick={() => onOpenReader(detail, 1)}
                className="rounded-2xl px-4 py-3.5 text-[14px] font-semibold active:scale-[0.98] transition-transform"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                从头看
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-2xl space-y-4 px-4">
        {cloudFavMsg && (
          <div className="ios-card rounded-2xl px-4 py-3 text-center text-[13px] font-medium">
            {cloudFavMsg}
          </div>
        )}

        {detail?.chapters && detail.chapters.length > 1 && (
          <section className="ios-card rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-1.5 text-[14px] font-bold">
              <Layers className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              章节列表 ({detail.chapters.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {detail.chapters.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  disabled={chapterLoadingId === ch.id}
                  onClick={() => handleOpenChapter(ch)}
                  className="truncate rounded-xl px-3 py-2.5 text-left text-[12px] font-semibold active:scale-95 disabled:opacity-50"
                  style={{ background: 'var(--bg-chip)' }}
                >
                  {chapterLoadingId === ch.id ? '加载中...' : ch.title}
                </button>
              ))}
            </div>
          </section>
        )}
        {loading && !detail && (
          <div className="ios-card flex flex-col items-center justify-center rounded-2xl py-12">
            <RefreshCw className="h-6 w-6 animate-spin opacity-60" />
            <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              正在解析画廊信息...
            </p>
          </div>
        )}

        {error && (
          <div className="ios-card rounded-2xl p-4 text-center">
            <p className="text-sm text-rose-500">{error}</p>
            <button
              type="button"
              onClick={() => loadDetail(previewPage)}
              className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold text-white"
              style={{ background: 'var(--accent)' }}
            >
              重试
            </button>
          </div>
        )}

        {detail && (
          <>
            {/* Metadata Strip */}
            <div className="ios-card grid grid-cols-3 divide-x rounded-2xl py-3 text-center text-[12px]" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="px-2">
                <div style={{ color: 'var(--text-secondary)' }}>上传者</div>
                <div className="mt-0.5 truncate font-semibold">{detail.uploader}</div>
              </div>
              <div className="px-2">
                <div style={{ color: 'var(--text-secondary)' }}>收藏数</div>
                <div className="mt-0.5 font-semibold">{detail.favoritedCount}</div>
              </div>
              <div className="px-2">
                <div style={{ color: 'var(--text-secondary)' }}>发布时间</div>
                <div className="mt-0.5 truncate font-semibold">
                  {detail.posted.split(' ')[0] || '—'}
                </div>
              </div>
            </div>

            {/* Tag Groups */}
            {detail.tagGroups.length > 0 && (
              <section className="ios-card rounded-2xl p-4">
                <div className="mb-3 flex items-center gap-1.5 text-[14px] font-bold">
                  <Tag className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                  标签（点击即可搜索）
                </div>
                <div className="space-y-2.5">
                  {detail.tagGroups.map((group) => (
                    <div key={group.namespace} className="flex flex-wrap items-start gap-1.5">
                      <span
                        className="mt-0.5 mr-1 text-[11px] font-semibold uppercase"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {translateNamespace(group.namespace, settings.translateTags)}:
                      </span>
                      {group.tags.map((tag) => {
                        const query =
                          tag.includes(' ')
                            ? `${group.namespace}:"${tag}"$`
                            : `${group.namespace}:${tag}$`;
                        const translated = translateTag(
                          group.namespace,
                          tag,
                          settings.translateTags
                        );
                        return (
                          <button
                            key={`${group.namespace}:${tag}`}
                            type="button"
                            title={`${group.namespace}:${tag}`}
                            onClick={() => onSearchTag(query)}
                            className="rounded-lg px-2.5 py-1 text-[12px] font-medium active:scale-95 transition-transform"
                            style={{ background: 'var(--bg-chip)' }}
                          >
                            {translated}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Comments Accordion */}
            {detail.comments.length > 0 && (
              <section className="ios-card overflow-hidden rounded-2xl">
                <button
                  type="button"
                  onClick={() => setShowComments((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3.5 text-[14px] font-bold"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    评论 ({detail.comments.length})
                  </span>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--accent)' }}>
                    {showComments ? '收起' : '展开'}
                  </span>
                </button>
                {showComments && (
                  <div
                    className="divide-y px-4 pb-3"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    {detail.comments.map((c) => (
                      <div key={c.id} className="py-3">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="font-semibold">
                            {c.author}
                            {c.isUploader && (
                              <span className="ml-1.5 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-400">
                                UP
                              </span>
                            )}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {c.score} · {c.postedAt}
                          </span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed opacity-90">
                          {c.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Preview Thumbnail Grid */}
            <section className="ios-card rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[14px] font-bold">
                  页面预览 ({detail.previews.length} / {detail.pages})
                </h2>
                {detail.previewPageCount > 1 && (
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <button
                      type="button"
                      disabled={previewPage <= 0 || loading}
                      onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                      className="rounded-lg px-2.5 py-1 font-medium disabled:opacity-40"
                      style={{ background: 'var(--bg-chip)' }}
                    >
                      上一页
                    </button>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {previewPage + 1}/{detail.previewPageCount}
                    </span>
                    <button
                      type="button"
                      disabled={previewPage + 1 >= detail.previewPageCount || loading}
                      onClick={() => setPreviewPage((p) => p + 1)}
                      className="rounded-lg px-2.5 py-1 font-medium disabled:opacity-40"
                      style={{ background: 'var(--bg-chip)' }}
                    >
                      下一页
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {detail.previews.map((item) => (
                  <PreviewThumb
                    key={item.page}
                    item={item}
                    onClick={() => onOpenReader(detail, item.page)}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};
