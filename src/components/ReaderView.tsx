import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Download,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Rows3,
} from 'lucide-react';
import type {
  AppSettings,
  GalleryDetail,
  ReaderImageResponse,
  ReadingMode,
} from '../../shared/types';
import { buildImageUrl, fetchGalleryDetail, fetchReaderImage } from '../lib/api';
import { unscrambleJmImageUrl } from '../lib/jmUnscramble';

interface ReaderViewProps {
  detail: GalleryDetail;
  initialPage: number;
  settings: AppSettings;
  onChangeReadingMode: (mode: ReadingMode) => void;
  onProgressChange: (page: number) => void;
  onClose: () => void;
}

const MODE_LABELS: Record<ReadingMode, string> = {
  vertical: '竖屏滚动',
  ltr: '左→右',
  rtl: '右→左',
};

export const ReaderView: React.FC<ReaderViewProps> = ({
  detail,
  initialPage,
  settings,
  onChangeReadingMode,
  onProgressChange,
  onClose,
}) => {
  const totalPages = Math.max(detail.pages, detail.previews.length, 1);
  const [currentPage, setCurrentPage] = useState(() =>
    Math.max(1, Math.min(totalPages, initialPage))
  );
  const [hudVisible, setHudVisible] = useState(true);
  const [mode, setMode] = useState<ReadingMode>(settings.readingMode);

  // Map of pageNumber -> pageToken
  const [tokenMap, setTokenMap] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const p of detail.previews) {
      initial[p.page] = p.pageToken;
    }
    return initial;
  });

  // Resolved image metadata per page
  const [pageData, setPageData] = useState<Record<number, ReaderImageResponse>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});
  const [errorPages, setErrorPages] = useState<Record<number, string>>({});

  // Track fetched preview pages so we can resolve tokens for large galleries
  const fetchedPreviewPages = useRef<Set<number>>(new Set([detail.currentPreviewPage]));
  const inFlightPages = useRef<Set<number>>(new Set());
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const verticalRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const [actionSheetPage, setActionSheetPage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 2400);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (pageNum: number, clientX: number, clientY: number) => {
      clearLongPress();
      longPressTriggeredRef.current = false;
      touchStartRef.current = { x: clientX, y: clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        setActionSheetPage(pageNum);
      }, 520);
    },
    [clearLongPress]
  );

  const handleTouchMoveCancelLongPress = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || e.touches.length !== 1) {
        clearLongPress();
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
      const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);
      if (dx > 12 || dy > 12) {
        clearLongPress();
      }
    },
    [clearLongPress]
  );

  const savePageImage = useCallback(
    async (pageNum: number) => {
      const data = pageDataRef.current[pageNum];
      if (!data?.imageUrl) {
        showToast('图片尚未加载完成');
        return;
      }
      setSaving(true);
      try {
        const proxied = buildImageUrl(data.imageUrl);
        const res = await fetch(proxied);
        if (!res.ok) throw new Error('下载失败');
        const blob = await res.blob();
        const ext = blob.type.includes('png')
          ? 'png'
          : blob.type.includes('webp')
            ? 'webp'
            : blob.type.includes('gif')
              ? 'gif'
              : blob.type.includes('svg')
                ? 'svg'
                : 'jpg';
        const fileName =
          data.fileName || `ehweb_${detail.gid}_p${String(pageNum).padStart(3, '0')}.${ext}`;
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });

        // Prefer iOS native share sheet (allows direct "存储图像 / Save to Photos")
        if (
          typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] })
        ) {
          await navigator.share({
            files: [file],
            title: fileName,
          });
          showToast('已打开系统保存菜单');
        } else {
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
          showToast(`已开始下载 ${fileName}`);
        }
      } catch (err) {
        // User cancelling native share sheet throws AbortError — ignore silently
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        showToast('保存失败，可尝试「新标签页打开原图」');
      } finally {
        setSaving(false);
        setActionSheetPage(null);
      }
    },
    [detail.gid, showToast]
  );

  // Keep latest tokenMap in ref for async helpers
  const tokenMapRef = useRef(tokenMap);
  tokenMapRef.current = tokenMap;
  const pageDataRef = useRef(pageData);
  pageDataRef.current = pageData;

  useEffect(() => {
    onProgressChange(currentPage);
  }, [currentPage, onProgressChange]);

  // Resolve a pageToken if not yet known (for galleries with > 1 preview page)
  const ensurePageToken = useCallback(
    async (pageNum: number): Promise<string | null> => {
      if (tokenMapRef.current[pageNum]) return tokenMapRef.current[pageNum];
      if (settings.demoMode) return `demo${detail.gid}p${pageNum}`;

      // Estimate which preview page holds `pageNum`
      const perPage = Math.max(detail.previews.length, 20);
      const targetPreviewIdx = Math.floor((pageNum - 1) / perPage);

      if (!fetchedPreviewPages.current.has(targetPreviewIdx)) {
        fetchedPreviewPages.current.add(targetPreviewIdx);
        try {
          const more = await fetchGalleryDetail(
            detail.gid,
            detail.token,
            targetPreviewIdx,
            settings
          );
          const additions: Record<number, string> = {};
          for (const p of more.previews) {
            additions[p.page] = p.pageToken;
          }
          setTokenMap((prev) => ({ ...prev, ...additions }));
          if (additions[pageNum]) return additions[pageNum];
        } catch {
          // fallback below
        }
      }

      return tokenMapRef.current[pageNum] || null;
    },
    [detail.gid, detail.token, detail.previews.length, settings]
  );

  const loadPage = useCallback(
    async (pageNum: number, forceReload = false) => {
      if (pageNum < 1 || pageNum > totalPages) return;
      if (!forceReload && pageDataRef.current[pageNum]) return;
      if (inFlightPages.current.has(pageNum)) return;

      inFlightPages.current.add(pageNum);
      setLoadingPages((prev) => ({ ...prev, [pageNum]: true }));
      setErrorPages((prev) => {
        const next = { ...prev };
        delete next[pageNum];
        return next;
      });

      try {
        // Direct image mode for Pixiv & JMComic (with optional Canvas unscrambling for JMComic)
        const directPreview = detail.previews.find((p) => p.page === pageNum);
        if (directPreview?.directImageUrl) {
          let finalUrl = directPreview.directImageUrl;
          if (directPreview.scrambleAid && directPreview.scramblePageName) {
            finalUrl = await unscrambleJmImageUrl(
              buildImageUrl(directPreview.directImageUrl),
              directPreview.scrambleAid,
              directPreview.scramblePageName
            );
          }
          const directResult: ReaderImageResponse = {
            gid: detail.gid,
            page: pageNum,
            pageToken: directPreview.pageToken,
            imageUrl: finalUrl,
            fileName: `${detail.source}_${detail.gid}_p${String(pageNum).padStart(3, '0')}.jpg`,
            totalPages,
          };
          setPageData((prev) => ({ ...prev, [pageNum]: directResult }));
          if (!finalUrl.startsWith('blob:')) {
            const img = new Image();
            img.src = buildImageUrl(finalUrl);
          }
          return;
        }

        const token = await ensurePageToken(pageNum);
        if (!token) {
          throw new Error(`未找到第 ${pageNum} 页的索引令牌`);
        }

        const nl = forceReload ? pageDataRef.current[pageNum]?.reloadKey : undefined;
        const result = await fetchReaderImage(detail.gid, token, pageNum, settings, nl);

        setPageData((prev) => ({ ...prev, [pageNum]: result }));

        // Capture neighbor tokens discovered from E-Hentai's #next / #prev links
        if (result.nextPageToken || result.prevPageToken) {
          setTokenMap((prev) => ({
            ...prev,
            ...(result.nextPageToken ? { [pageNum + 1]: result.nextPageToken } : {}),
            ...(result.prevPageToken ? { [pageNum - 1]: result.prevPageToken } : {}),
          }));
        }

        // Warm browser image cache
        if (result.imageUrl) {
          const img = new Image();
          img.src = buildImageUrl(result.imageUrl);
        }
      } catch (err) {
        setErrorPages((prev) => ({
          ...prev,
          [pageNum]: err instanceof Error ? err.message : '图片加载失败',
        }));
      } finally {
        inFlightPages.current.delete(pageNum);
        setLoadingPages((prev) => ({ ...prev, [pageNum]: false }));
      }
    },
    [detail.gid, ensurePageToken, settings, totalPages]
  );

  // Load current page + preload next N pages + previous 1 page
  useEffect(() => {
    loadPage(currentPage);
    if (currentPage > 1) {
      loadPage(currentPage - 1);
    }
    for (let i = 1; i <= settings.preloadCount; i++) {
      if (currentPage + i <= totalPages) {
        loadPage(currentPage + i);
      }
    }
  }, [currentPage, loadPage, settings.preloadCount, totalPages]);

  const goToPage = useCallback(
    (target: number) => {
      const clamped = Math.max(1, Math.min(totalPages, target));
      setCurrentPage(clamped);
      if (mode === 'vertical') {
        const el = verticalRefs.current[clamped];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [mode, totalPages]
  );

  const goNext = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);
  const goPrev = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);

  // Keyboard navigation for iPad / Desktop
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') {
        if (mode === 'rtl') goPrev();
        else goNext();
      } else if (e.key === 'ArrowLeft') {
        if (mode === 'rtl') goNext();
        else goPrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, mode, onClose]);

  const cycleMode = () => {
    const order: ReadingMode[] = ['vertical', 'ltr', 'rtl'];
    const next = order[(order.indexOf(mode) + 1) % order.length];
    setMode(next);
    onChangeReadingMode(next);
  };

  // Vertical mode: observe visible pages to update currentPage and trigger loading
  useEffect(() => {
    if (mode !== 'vertical') return;
    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage: number | null = null;
        let bestRatio = 0;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > bestRatio) {
            const p = Number((entry.target as HTMLElement).dataset.page);
            if (!Number.isNaN(p)) {
              bestRatio = entry.intersectionRatio;
              bestPage = p;
            }
          }
        }
        if (bestPage !== null) {
          setCurrentPage(bestPage);
        }
      },
      { threshold: [0.25, 0.5, 0.75] }
    );

    Object.values(verticalRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [mode, totalPages]);

  // Touch swipe + long-press for paged modes
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startLongPress(currentPage, e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    clearLongPress();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      touchStartRef.current = null;
      return;
    }
    if (mode === 'vertical' || !touchStartRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) {
        if (mode === 'rtl') goPrev();
        else goNext();
      } else {
        if (mode === 'rtl') goNext();
        else goPrev();
      }
    }
  };

  const handlePagedTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (longPressTriggeredRef.current || actionSheetPage !== null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX < 0.28) {
      if (mode === 'rtl') goNext();
      else goPrev();
    } else if (relX > 0.72) {
      if (mode === 'rtl') goPrev();
      else goNext();
    } else {
      setHudVisible((v) => !v);
    }
  };

  const currentData = pageData[currentPage];
  const currentError = errorPages[currentPage];
  const currentLoading = loadingPages[currentPage];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white select-none">
      {/* Top Frosted HUD */}
      <header
        className={`safe-pt fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-2 bg-black/70 px-3 py-2.5 backdrop-blur-xl transition-transform duration-200 ${
          hudVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/12 px-3 py-1.5 text-[14px] font-medium active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-[13px] font-semibold">{detail.title}</div>
          <div className="text-[11px] text-white/65">
            {currentPage} / {totalPages}
          </div>
        </div>

        <button
          type="button"
          onClick={cycleMode}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/12 px-3 py-1.5 text-[12px] font-medium active:scale-95"
        >
          {mode === 'vertical' ? (
            <Rows3 className="h-3.5 w-3.5" />
          ) : (
            <Columns2 className="h-3.5 w-3.5" />
          )}
          {MODE_LABELS[mode]}
        </button>
      </header>

      {/* Reader Viewport */}
      {mode === 'vertical' ? (
        <div
          className="flex-1 overflow-y-auto bg-black"
          onClick={() => setHudVisible((v) => !v)}
        >
          <div className="mx-auto flex max-w-3xl flex-col items-center py-12">
            {Array.from({ length: totalPages }, (_, idx) => {
              const pNum = idx + 1;
              const data = pageData[pNum];
              const err = errorPages[pNum];
              const isNear = Math.abs(pNum - currentPage) <= settings.preloadCount + 2;

              return (
                <div
                  key={pNum}
                  data-page={pNum}
                  ref={(el) => {
                    verticalRefs.current[pNum] = el;
                  }}
                  className="relative flex min-h-[60vh] w-full items-center justify-center border-b border-white/5"
                >
                  {data?.imageUrl ? (
                    <img
                      src={buildImageUrl(data.imageUrl)}
                      alt={`Page ${pNum}`}
                      loading="lazy"
                      decoding="async"
                      onTouchStart={(e) => {
                        if (e.touches.length === 1) {
                          startLongPress(pNum, e.touches[0].clientX, e.touches[0].clientY);
                        }
                      }}
                      onTouchMove={handleTouchMoveCancelLongPress}
                      onTouchEnd={clearLongPress}
                      onTouchCancel={clearLongPress}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActionSheetPage(pNum);
                      }}
                      className="reader-img-saveable w-full h-auto object-contain"
                    />
                  ) : err ? (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                      <span className="text-xs text-rose-400">
                        第 {pNum} 页：{err}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadPage(pNum, true);
                        }}
                        className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-medium"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        重新加载
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-20 text-white/50">
                      <RefreshCw
                        className={`h-5 w-5 ${isNear ? 'animate-spin' : ''}`}
                      />
                      <span className="text-xs">第 {pNum} 页</span>
                      {!isNear && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadPage(pNum);
                          }}
                          className="rounded-full bg-white/10 px-3 py-1 text-[11px] text-white/80"
                        >
                          点击加载
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden bg-black"
          onClick={handlePagedTap}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMoveCancelLongPress}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={clearLongPress}
          onContextMenu={(e) => {
            e.preventDefault();
            setActionSheetPage(currentPage);
          }}
        >
          {currentData?.imageUrl ? (
            <img
              key={`${currentPage}-${currentData.imageUrl}`}
              src={buildImageUrl(currentData.imageUrl)}
              alt={`Page ${currentPage}`}
              decoding="async"
              fetchPriority="high"
              className="reader-img-saveable max-h-full max-w-full object-contain"
            />
          ) : currentError ? (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p className="text-sm text-rose-400">{currentError}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  loadPage(currentPage, true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                换源重试
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-white/60">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="text-xs">正在加载第 {currentPage} 页...</span>
            </div>
          )}

          {/* Subtle corner page pill when HUD is hidden */}
          {!hudVisible && (
            <div className="safe-pb pointer-events-none fixed bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-md">
              {currentPage} / {totalPages}
            </div>
          )}
        </div>
      )}

      {/* Bottom Frosted Scrubber HUD */}
      <footer
        className={`safe-pb fixed bottom-0 inset-x-0 z-30 bg-black/75 px-4 pt-3 pb-4 backdrop-blur-xl transition-transform duration-200 ${
          hudVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={goPrev}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 disabled:opacity-35 active:scale-90"
              aria-label="上一页"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <input
              type="range"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(Number(e.target.value))}
              className="ios-slider flex-1"
            />

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={goNext}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 disabled:opacity-35 active:scale-90"
              aria-label="下一页"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setActionSheetPage(currentPage)}
              disabled={!currentData?.imageUrl}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 disabled:opacity-35 active:scale-90"
              aria-label="保存当前页图片"
            >
              <Download className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => loadPage(currentPage, true)}
              disabled={currentLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 active:scale-90"
              aria-label="刷新当前页"
            >
              <RotateCcw className={`h-4 w-4 ${currentLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="pointer-events-none fixed top-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-neutral-900/90 px-4 py-2 text-[13px] font-medium text-white shadow-lg backdrop-blur-md">
          {toast}
        </div>
      )}

      {/* iOS Long-Press Image Save Action Sheet */}
      {actionSheetPage !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-3 pb-4 backdrop-blur-xs"
          onClick={() => setActionSheetPage(null)}
        >
          <div
            className="safe-pb w-full max-w-md space-y-2.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-hidden rounded-2xl bg-neutral-900/95 text-center backdrop-blur-xl divide-y divide-white/10">
              <div className="px-4 py-3">
                <div className="text-[12px] font-semibold text-white/60">
                  第 {actionSheetPage} 页 / 共 {totalPages} 页
                </div>
                {pageData[actionSheetPage]?.fileName && (
                  <div className="mt-0.5 truncate text-[11px] text-white/40">
                    {pageData[actionSheetPage].fileName}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={saving || !pageData[actionSheetPage]?.imageUrl}
                onClick={() => savePageImage(actionSheetPage)}
                className="flex w-full items-center justify-center gap-2 py-3.5 text-[16px] font-semibold text-indigo-400 active:bg-white/10 disabled:opacity-40"
              >
                <Download className="h-4.5 w-4.5" />
                {saving ? '正在准备图片...' : '保存图片到相册 / 下载'}
              </button>

              {pageData[actionSheetPage]?.imageUrl && (
                <a
                  href={buildImageUrl(pageData[actionSheetPage].imageUrl)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setActionSheetPage(null)}
                  className="flex w-full items-center justify-center gap-2 py-3.5 text-[16px] font-medium text-white active:bg-white/10"
                >
                  <ExternalLink className="h-4.5 w-4.5" />
                  新标签页打开原图
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  const p = actionSheetPage;
                  setActionSheetPage(null);
                  loadPage(p, true);
                }}
                className="flex w-full items-center justify-center gap-2 py-3.5 text-[16px] font-medium text-white active:bg-white/10"
              >
                <RotateCcw className="h-4.5 w-4.5" />
                换源重新加载本页
              </button>
            </div>

            <button
              type="button"
              onClick={() => setActionSheetPage(null)}
              className="w-full rounded-2xl bg-neutral-900/95 py-3.5 text-[16px] font-bold text-white active:bg-white/10"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
