import React from 'react';
import { Check, KeyRound, X } from 'lucide-react';
import type { AppSettings, EhSite } from '../../shared/types';

interface SiteSwitcherSheetProps {
  open: boolean;
  settings: AppSettings;
  onSelectSite: (site: EhSite) => void;
  onOpenCookieGuide: (site: EhSite) => void;
  onClose: () => void;
}

export const SITE_META: Record<
  EhSite,
  { name: string; subtitle: string; badgeColor: string; url: string }
> = {
  'e-hentai': {
    name: 'E-Hentai',
    subtitle: '表站画廊 · 同人志 / 漫画 / CG',
    badgeColor: '#5856d6',
    url: 'https://e-hentai.org/',
  },
  exhentai: {
    name: 'ExHentai',
    subtitle: '里站画廊 · 需登录 Cookie',
    badgeColor: '#7c3aed',
    url: 'https://exhentai.org/',
  },
  pixiv: {
    name: 'Pixiv',
    subtitle: '插画排行榜 · 多图漫画阅读器',
    badgeColor: '#0096FA',
    url: 'https://www.pixiv.net/',
  },
  jmcomic: {
    name: '禁漫天堂',
    subtitle: '18comic · 自动切片还原 + 分话阅读',
    badgeColor: '#FF6B35',
    url: 'https://18comic.vip/',
  },
};

export const SiteSwitcherSheet: React.FC<SiteSwitcherSheetProps> = ({
  open,
  settings,
  onSelectSite,
  onOpenCookieGuide,
  onClose,
}) => {
  if (!open) return null;

  const isLoggedIn = (site: EhSite): boolean => {
    if (site === 'e-hentai' || site === 'exhentai') {
      return Boolean(settings.cookie.includes('ipb_member_id'));
    }
    if (site === 'pixiv') {
      return Boolean(settings.pixivCookie.includes('PHPSESSID'));
    }
    return Boolean(settings.jmCookie.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="ios-card safe-pb relative z-10 w-full max-w-lg rounded-t-3xl p-5 shadow-2xl"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-neutral-400/40" />

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[17px] font-bold">切换阅读站点</h2>
            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              支持多站点独立浏览、专属阅读优化与账号收藏
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--bg-chip)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2.5">
          {(['e-hentai', 'exhentai', 'pixiv', 'jmcomic'] as EhSite[]).map((site) => {
            const meta = SITE_META[site];
            const active = settings.site === site && !settings.demoMode;
            const logged = isLoggedIn(site);
            return (
              <div
                key={site}
                onClick={() => {
                  onSelectSite(site);
                  onClose();
                }}
                role="button"
                tabIndex={0}
                className="flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all active:scale-[0.985] cursor-pointer"
                style={{
                  borderColor: active ? meta.badgeColor : 'var(--border-subtle)',
                  background: active ? `${meta.badgeColor}14` : 'var(--bg-primary)',
                }}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[14px] font-extrabold text-white shadow-xs"
                    style={{ backgroundColor: meta.badgeColor }}
                  >
                    {site === 'pixiv' ? 'P' : site === 'jmcomic' ? 'JM' : site === 'exhentai' ? 'EX' : 'EH'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold">{meta.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          logged
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-neutral-500/15 text-neutral-400'
                        }`}
                      >
                        {logged ? '已登录' : '未登录'}
                      </span>
                    </div>
                    <div className="truncate text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                      {meta.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                      onOpenCookieGuide(site);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold active:scale-95"
                    style={{ background: 'var(--bg-chip)' }}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {logged ? '账号' : '登录'}
                  </button>
                  {active && (
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: meta.badgeColor }}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
