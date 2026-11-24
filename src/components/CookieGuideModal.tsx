import React, { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  KeyRound,
  LogIn,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { AppSettings, EhSite } from '../../shared/types';
import { ehOfficialLogin } from '../lib/api';

interface CookieGuideModalProps {
  open: boolean;
  initialSite: EhSite;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onClose: () => void;
}

const EH_BOOKMARKLET =
  "javascript:(()=>{const c=document.cookie;if(!c){alert('未检测到 Cookie，请确认已登录');return;}prompt('请全选复制下方 Cookie 粘贴回 EhWeb：',c);})();";

export const CookieGuideModal: React.FC<CookieGuideModalProps> = ({
  open,
  initialSite,
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [siteTab, setSiteTab] = useState<'eh' | 'pixiv' | 'jm'>(() =>
    initialSite === 'pixiv' ? 'pixiv' : initialSite === 'jmcomic' ? 'jm' : 'eh'
  );
  const [ehUsername, setEhUsername] = useState('');
  const [ehPassword, setEhPassword] = useState('');
  const [ehLoginLoading, setEhLoginLoading] = useState(false);
  const [ehLoginMsg, setEhLoginMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);

  if (!open) return null;

  const handleEhPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEhLoginLoading(true);
    setEhLoginMsg(null);
    try {
      const res = await ehOfficialLogin(ehUsername, ehPassword, settings);
      onUpdateSettings({ cookie: res.cookie });
      setEhLoginMsg({ ok: true, text: '官方接口登录成功！已自动保存 Cookie。' });
      setEhPassword('');
    } catch (err) {
      setEhLoginMsg({
        ok: false,
        text: err instanceof Error ? err.message : '登录失败，请改用下方 Cookie 导入。',
      });
    } finally {
      setEhLoginLoading(false);
    }
  };

  const smartExtractCookie = (raw: string, target: 'eh' | 'pixiv' | 'jm'): string => {
    const trimmed = raw.trim();
    if (target === 'pixiv') {
      const m = trimmed.match(/PHPSESSID=([^;\s"']+)/i);
      if (m) return `PHPSESSID=${m[1]}`;
      // If user pasted only the value like 12345678_abcdef...
      if (/^\d+_[A-Za-z0-9]+$/.test(trimmed)) return `PHPSESSID=${trimmed}`;
    }
    return trimmed;
  };

  const copyBookmarklet = () => {
    navigator.clipboard?.writeText(EH_BOOKMARKLET).then(() => {
      setCopiedBookmarklet(true);
      setTimeout(() => setCopiedBookmarklet(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/55 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={onClose} />
      <div
        className="ios-card safe-pb relative z-10 max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl"
        style={{ background: 'var(--bg-secondary)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-[17px] font-bold">账号登录与 Cookie 导入教程</h2>
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

        {/* Site Tabs */}
        <div
          className="mt-4 grid grid-cols-3 rounded-xl p-1 text-[12px] font-semibold"
          style={{ background: 'var(--bg-chip)' }}
        >
          {(
            [
              { id: 'eh', label: 'E-Hentai / 里站' },
              { id: 'pixiv', label: 'Pixiv' },
              { id: 'jm', label: '禁漫天堂' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSiteTab(t.id)}
              className="rounded-lg py-1.5 transition-all"
              style={{
                background: siteTab === t.id ? 'var(--bg-secondary)' : 'transparent',
                color: siteTab === t.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* E-Hentai / ExHentai Tab */}
        {siteTab === 'eh' && (
          <div className="mt-4 space-y-4">
            {/* Method 1: Official Login API */}
            <form
              onSubmit={handleEhPasswordLogin}
              className="rounded-2xl border p-3.5 space-y-2.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">方式一：调用官网账号密码接口登录</span>
                <span className="text-[10px] opacity-60">无验证码时一步搞定</span>
              </div>
              <input
                type="text"
                value={ehUsername}
                onChange={(e) => setEhUsername(e.target.value)}
                placeholder="E-Hentai 论坛用户名"
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />
              <input
                type="password"
                value={ehPassword}
                onChange={(e) => setEhPassword(e.target.value)}
                placeholder="密码"
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />
              <button
                type="submit"
                disabled={ehLoginLoading || !ehUsername || !ehPassword}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
                style={{ background: 'var(--accent)' }}
              >
                {ehLoginLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}
                {ehLoginLoading ? '正在请求官网登录...' : '登录并自动获取 Cookie'}
              </button>
              {ehLoginMsg && (
                <p
                  className={`text-[12px] ${
                    ehLoginMsg.ok ? 'text-emerald-500' : 'text-rose-500'
                  }`}
                >
                  {ehLoginMsg.text}
                </p>
              )}
            </form>

            {/* Method 2: Cookie Import */}
            <div
              className="rounded-2xl border p-3.5 space-y-2.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">方式二：导入 Cookie（支持里站 ExHentai）</span>
                <a
                  href="https://forums.e-hentai.org/index.php?act=Login"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold"
                  style={{ color: 'var(--accent)' }}
                >
                  去官网登录 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <textarea
                rows={2}
                value={settings.cookie}
                onChange={(e) => onUpdateSettings({ cookie: e.target.value.trim() })}
                placeholder="ipb_member_id=...; ipb_pass_hash=...; igneous=..."
                className="w-full rounded-xl border px-3 py-2 text-[12px] font-mono outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />
              <ol
                className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                <li>
                  <b>电脑浏览器（最简单）</b>：登录 <code>e-hentai.org</code>（里站再打开{' '}
                  <code>exhentai.org</code>），按 <b>F12</b> → <b>Application（应用）</b> →{' '}
                  <b>Cookies</b>，复制 <code>ipb_member_id</code>、<code>ipb_pass_hash</code>
                  （里站加 <code>igneous</code>）。
                </li>
                <li>
                  <b>iPhone Safari 书签小工具</b>：复制下方脚本，在 Safari 随便收藏一个网页并把网址改成它；登录 E-Hentai 后点一下该书签即可弹出 Cookie 复制回来：
                </li>
              </ol>
              <button
                type="button"
                onClick={copyBookmarklet}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                {copiedBookmarklet ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedBookmarklet ? '已复制 Safari 书签脚本' : '复制 Safari 一键提取 Cookie 书签脚本'}
              </button>
            </div>
          </div>
        )}

        {/* Pixiv Tab */}
        {siteTab === 'pixiv' && (
          <div className="mt-4 space-y-3">
            <div
              className="rounded-2xl border p-3.5 space-y-2.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">Pixiv PHPSESSID Cookie</span>
                <a
                  href="https://www.pixiv.net/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-500"
                >
                  打开 Pixiv 官网 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <textarea
                rows={2}
                value={settings.pixivCookie}
                onChange={(e) =>
                  onUpdateSettings({
                    pixivCookie: smartExtractCookie(e.target.value, 'pixiv'),
                  })
                }
                placeholder="粘贴 PHPSESSID=12345678_xxxxx 或直接粘贴其值（自动识别）"
                className="w-full rounded-xl border px-3 py-2 text-[12px] font-mono outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />
              <div
                className="flex items-start gap-2 rounded-xl p-2.5 text-[11.5px] leading-relaxed"
                style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)' }}
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  由于 Pixiv 登录强制使用 Google reCAPTCHA 且 <code>PHPSESSID</code> 为 HttpOnly
                  保护（浏览器不允许网页脚本自动读取），需从浏览器 F12 面板复制一次即可长期生效（支持同步官方收藏、关注画师和 R-18）。
                </span>
              </div>
              <ol
                className="list-decimal space-y-1 pl-4 text-[12px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                <li>在电脑 Chrome / Edge / Safari 登录 <code>www.pixiv.net</code>。</li>
                <li>按 <b>F12</b> 打开开发者工具 → <b>Application（应用）</b> → <b>Cookies</b> → <code>https://www.pixiv.net</code>。</li>
                <li>找到名称为 <code>PHPSESSID</code> 的一行，复制它的 <b>Value（值）</b> 粘贴到上方输入框即可。</li>
              </ol>
            </div>
          </div>
        )}

        {/* JMComic Tab */}
        {siteTab === 'jm' && (
          <div className="mt-4 space-y-3">
            <div
              className="rounded-2xl border p-3.5 space-y-2.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            >
              <div className="text-[13px] font-bold">禁漫天堂镜像域名</div>
              <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                若默认域名被拦截或触发验证，可随时切换可用镜像站（例如 <code>https://18comic.vip</code>、<code>https://18comic.org</code>）。
              </p>
              <input
                type="url"
                value={settings.jmDomain}
                onChange={(e) => onUpdateSettings({ jmDomain: e.target.value })}
                placeholder="https://18comic.vip"
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />

              <div className="pt-2 text-[13px] font-bold">禁漫 Cookie（可选，用于云端收藏）</div>
              <textarea
                rows={2}
                value={settings.jmCookie}
                onChange={(e) => onUpdateSettings({ jmCookie: e.target.value.trim() })}
                placeholder="AVS=..."
                className="w-full rounded-xl border px-3 py-2 text-[12px] font-mono outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl py-3 text-[15px] font-semibold text-white active:scale-[0.98]"
          style={{ background: 'var(--accent)' }}
        >
          完成并保存
        </button>
      </div>
    </div>
  );
};
