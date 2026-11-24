import React, { useEffect, useState } from 'react';
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

function extractCookieValue(cookieStr: string, key: string): string {
  const regex = new RegExp(`(?:^|;\\s*)${key}=([^;]+)`, 'i');
  const match = cookieStr.match(regex);
  return match ? match[1].trim() : '';
}

function stripKeyPrefix(val: string, key: string): string {
  const trimmed = val.trim();
  const regex = new RegExp(`^${key}=`, 'i');
  return trimmed.replace(regex, '').replace(/;+$/, '').trim();
}

function assembleEhCookie(memberId: string, passHash: string, igneous: string): string {
  const parts: string[] = [];
  if (memberId.trim()) parts.push(`ipb_member_id=${memberId.trim()}`);
  if (passHash.trim()) parts.push(`ipb_pass_hash=${passHash.trim()}`);
  if (igneous.trim()) parts.push(`igneous=${igneous.trim()}`);
  return parts.join('; ');
}

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

  // Separate value-only fields for E-Hentai / ExHentai
  const [memberId, setMemberId] = useState(() =>
    extractCookieValue(settings.cookie, 'ipb_member_id')
  );
  const [passHash, setPassHash] = useState(() =>
    extractCookieValue(settings.cookie, 'ipb_pass_hash')
  );
  const [igneous, setIgneous] = useState(() =>
    extractCookieValue(settings.cookie, 'igneous')
  );

  // Value-only fields for Pixiv & JMComic
  const [pixivSessId, setPixivSessId] = useState(() =>
    extractCookieValue(settings.pixivCookie, 'PHPSESSID') ||
    stripKeyPrefix(settings.pixivCookie, 'PHPSESSID')
  );
  const [jmAvs, setJmAvs] = useState(() =>
    extractCookieValue(settings.jmCookie, 'AVS') || stripKeyPrefix(settings.jmCookie, 'AVS')
  );

  useEffect(() => {
    if (!open) return;
    setSiteTab(initialSite === 'pixiv' ? 'pixiv' : initialSite === 'jmcomic' ? 'jm' : 'eh');
    setMemberId(extractCookieValue(settings.cookie, 'ipb_member_id'));
    setPassHash(extractCookieValue(settings.cookie, 'ipb_pass_hash'));
    setIgneous(extractCookieValue(settings.cookie, 'igneous'));
    setPixivSessId(
      extractCookieValue(settings.pixivCookie, 'PHPSESSID') ||
        stripKeyPrefix(settings.pixivCookie, 'PHPSESSID')
    );
    setJmAvs(
      extractCookieValue(settings.jmCookie, 'AVS') || stripKeyPrefix(settings.jmCookie, 'AVS')
    );
  }, [open, initialSite, settings.cookie, settings.pixivCookie, settings.jmCookie]);

  if (!open) return null;

  const updateEhFields = (nextMember: string, nextHash: string, nextIgneous: string) => {
    setMemberId(nextMember);
    setPassHash(nextHash);
    setIgneous(nextIgneous);
    onUpdateSettings({ cookie: assembleEhCookie(nextMember, nextHash, nextIgneous) });
  };

  // If user pastes a full cookie string into any EH field, auto-split all 3 values!
  const handleEhFieldChange = (field: 'member' | 'hash' | 'igneous', raw: string) => {
    if (raw.includes('ipb_member_id=') && raw.includes('ipb_pass_hash=')) {
      const m = extractCookieValue(raw, 'ipb_member_id');
      const h = extractCookieValue(raw, 'ipb_pass_hash');
      const ig = extractCookieValue(raw, 'igneous') || igneous;
      updateEhFields(m, h, ig);
      return;
    }
    if (field === 'member') {
      updateEhFields(stripKeyPrefix(raw, 'ipb_member_id'), passHash, igneous);
    } else if (field === 'hash') {
      updateEhFields(memberId, stripKeyPrefix(raw, 'ipb_pass_hash'), igneous);
    } else {
      updateEhFields(memberId, passHash, stripKeyPrefix(raw, 'igneous'));
    }
  };

  const handlePixivChange = (raw: string) => {
    const val = extractCookieValue(raw, 'PHPSESSID') || stripKeyPrefix(raw, 'PHPSESSID');
    setPixivSessId(val);
    onUpdateSettings({ pixivCookie: val ? `PHPSESSID=${val}` : '' });
  };

  const handleJmAvsChange = (raw: string) => {
    const val = extractCookieValue(raw, 'AVS') || stripKeyPrefix(raw, 'AVS');
    setJmAvs(val);
    onUpdateSettings({ jmCookie: val ? `AVS=${val}` : '' });
  };

  const handleEhPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEhLoginLoading(true);
    setEhLoginMsg(null);
    try {
      const res = await ehOfficialLogin(ehUsername, ehPassword, settings);
      const m = extractCookieValue(res.cookie, 'ipb_member_id');
      const h = extractCookieValue(res.cookie, 'ipb_pass_hash');
      updateEhFields(m, h, igneous);
      setEhLoginMsg({ ok: true, text: '官方接口登录成功！已自动填入下方 Cookie。' });
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
            <h2 className="text-[17px] font-bold">账号登录与 Cookie 导入</h2>
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
            {/* Method 1: Separate Value-Only Cookie Fields (Primary & Most Reliable) */}
            <div
              className="rounded-2xl border p-3.5 space-y-3"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">Cookie 登录（直接粘贴对应值即可）</span>
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

              <div className="space-y-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    ipb_member_id <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={memberId}
                    onChange={(e) => handleEhFieldChange('member', e.target.value)}
                    placeholder="只需粘贴值，例如 1234567"
                    className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    ipb_pass_hash <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={passHash}
                    onChange={(e) => handleEhFieldChange('hash', e.target.value)}
                    placeholder="只需粘贴 32 位字符串"
                    className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    igneous <span className="opacity-70">（选填，仅访问里站 ExHentai 需要）</span>
                  </label>
                  <input
                    type="text"
                    value={igneous}
                    onChange={(e) => handleEhFieldChange('igneous', e.target.value)}
                    placeholder="只需粘贴值，不看里站可留空"
                    className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                  />
                </div>
              </div>

              <ol
                className="list-decimal space-y-1 pl-4 text-[11.5px] leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                <li>
                  电脑浏览器登录 <code>e-hentai.org</code>，按 <b>F12</b> → <b>Application（应用）</b> →{' '}
                  <b>Cookies</b>，双击复制上面对应行的 <b>Value（值）</b> 粘贴进来即可，无需手写前缀。
                </li>
                <li>
                  也可以直接把整段 <code>document.cookie</code> 粘贴到任意框中，会自动拆分填入。
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

            {/* Method 2: Official Login API */}
            <form
              onSubmit={handleEhPasswordLogin}
              className="rounded-2xl border p-3.5 space-y-2.5"
              style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-primary)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold">备选：账号密码直连官网接口</span>
                <span className="text-[10px] opacity-60">无验证码时可自动填充</span>
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
                <span className="text-[13px] font-bold">Pixiv 登录凭证</span>
                <a
                  href="https://www.pixiv.net/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-500"
                >
                  打开 Pixiv 官网 <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  PHPSESSID（只需粘贴值，无需前缀）
                </label>
                <input
                  type="text"
                  value={pixivSessId}
                  onChange={(e) => handlePixivChange(e.target.value)}
                  placeholder="例如 12345678_xxxxxxxxxxxxxxxx"
                  className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-sky-500/40"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                />
              </div>
              <div
                className="flex items-start gap-2 rounded-xl p-2.5 text-[11.5px] leading-relaxed"
                style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)' }}
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>
                  电脑浏览器登录 <code>www.pixiv.net</code> → 按 <b>F12</b> → <b>Application</b> →{' '}
                  <b>Cookies</b> → 找到 <code>PHPSESSID</code> 复制它的 <b>Value</b> 粘贴到上方即可。
                </span>
              </div>
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
              <input
                type="url"
                value={settings.jmDomain}
                onChange={(e) => onUpdateSettings({ jmDomain: e.target.value })}
                placeholder="https://18comic.vip"
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
              />

              <div className="pt-1">
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  AVS Cookie（选填，只需粘贴值）
                </label>
                <input
                  type="text"
                  value={jmAvs}
                  onChange={(e) => handleJmAvsChange(e.target.value)}
                  placeholder="留空可免登录浏览"
                  className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)' }}
                />
              </div>
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
