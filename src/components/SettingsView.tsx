import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Globe,
  KeyRound,
  Languages,
  Moon,
  Network,
  RefreshCw,
  Server,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import type { AppSettings, EhSite, ReadingMode, ThemeMode } from '../../shared/types';
import { fetchHealth, fetchTagTranslationDb, type HealthInfo } from '../lib/api';
import { getTagDbMeta, saveTagTranslationCache } from '../lib/tagTranslation';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onOpenCookieGuide: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdate,
  onOpenCookieGuide,
}) => {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [syncingDb, setSyncingDb] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [tagMeta, setTagMeta] = useState(() => getTagDbMeta());

  useEffect(() => {
    fetchHealth(settings).then(setHealth);
  }, [settings.apiBaseUrl]);

  const handleSyncTagDb = async () => {
    setSyncingDb(true);
    setSyncMessage(null);
    try {
      const data = await fetchTagTranslationDb(settings, true);
      await saveTagTranslationCache(data);
      setTagMeta(getTagDbMeta());
      setSyncMessage(`同步成功！已加载 ${data.count.toLocaleString()} 条中文标签（版本 ${data.version}）`);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '词库同步失败，请检查网络或代理设置');
    } finally {
      setSyncingDb(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 1800);
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 pb-28 pt-3">
      {/* Demo Mode Banner */}
      <section className="ios-card rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[15px] font-semibold">离线演示模式</div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                无需连接外网即可预览所有卡片、标签与阅读器手势
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.demoMode}
            onClick={() => onUpdate({ demoMode: !settings.demoMode })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.demoMode ? 'bg-indigo-500' : 'bg-neutral-400/40'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                settings.demoMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Chinese Tag Translation Section */}
      <section className="ios-card overflow-hidden rounded-2xl divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <Languages className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[15px] font-semibold">中文标签与分类翻译</div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                {tagMeta.synced
                  ? `已同步 EhTagTranslation 词库（${tagMeta.synced.count.toLocaleString()} 条）`
                  : `已内置 ${tagMeta.builtinCount} 条常用中文标签，可同步完整词库`}
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.translateTags}
            onClick={() => onUpdate({ translateTags: !settings.translateTags })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.translateTags ? 'bg-indigo-500' : 'bg-neutral-400/40'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                settings.translateTags ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="p-4">
          <button
            type="button"
            disabled={syncingDb}
            onClick={handleSyncTagDb}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-semibold text-white active:scale-[0.98] disabled:opacity-60 transition-transform"
            style={{ background: 'var(--accent)' }}
          >
            {syncingDb ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {syncingDb
              ? '正在同步 EhTagTranslation 完整词库...'
              : tagMeta.synced
                ? '更新 EhTagTranslation 完整中文词库'
                : '同步 EhTagTranslation 完整中文词库（数万条标签）'}
          </button>
          {syncMessage && (
            <p className="mt-2 text-center text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              {syncMessage}
            </p>
          )}
        </div>
      </section>

      {/* Site & Auth */}
      <section className="ios-card overflow-hidden rounded-2xl divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[14px] font-bold">
              <Globe className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              当前站点
            </div>
            <button
              type="button"
              onClick={onOpenCookieGuide}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <KeyRound className="h-3.5 w-3.5" />
              登录 / 导入 Cookie 教程
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(
              [
                { id: 'e-hentai', label: 'E-Hentai (表站)' },
                { id: 'exhentai', label: 'ExHentai (里站)' },
                { id: 'pixiv', label: 'Pixiv (插画/漫画)' },
                { id: 'jmcomic', label: '禁漫天堂 (18comic)' },
              ] as { id: EhSite; label: string }[]
            ).map((opt) => {
              const active = settings.site === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ site: opt.id, demoMode: false })}
                  className="rounded-xl py-2.5 text-[13px] font-semibold transition-all"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--bg-chip)',
                    color: active ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[14px] font-bold">
              <KeyRound className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              Cookie 配置（只需粘贴值，无需前缀）
            </div>
          </div>

          {settings.site === 'pixiv' ? (
            <div>
              <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Pixiv PHPSESSID
              </label>
              <input
                type="text"
                value={
                  settings.pixivCookie.match(/(?:^|;\s*)PHPSESSID=([^;]+)/i)?.[1] ||
                  settings.pixivCookie.replace(/^PHPSESSID=/i, '')
                }
                onChange={(e) => {
                  const val = e.target.value.trim().replace(/^PHPSESSID=/i, '').replace(/;+$/, '');
                  onUpdate({ pixivCookie: val ? `PHPSESSID=${val}` : '' });
                }}
                placeholder="只需粘贴值，例如 12345678_xxxxxxxx"
                className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
              />
            </div>
          ) : settings.site === 'jmcomic' ? (
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  禁漫镜像域名
                </label>
                <input
                  type="url"
                  value={settings.jmDomain}
                  onChange={(e) => onUpdate({ jmDomain: e.target.value })}
                  placeholder="https://18comic.vip"
                  className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/40"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  AVS（选填）
                </label>
                <input
                  type="text"
                  value={
                    settings.jmCookie.match(/(?:^|;\s*)AVS=([^;]+)/i)?.[1] ||
                    settings.jmCookie.replace(/^AVS=/i, '')
                  }
                  onChange={(e) => {
                    const val = e.target.value.trim().replace(/^AVS=/i, '').replace(/;+$/, '');
                    onUpdate({ jmCookie: val ? `AVS=${val}` : '' });
                  }}
                  placeholder="只需粘贴值，留空可免登录浏览"
                  className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                />
              </div>
            </div>
          ) : (
            (() => {
              const memberId = settings.cookie.match(/(?:^|;\s*)ipb_member_id=([^;]+)/i)?.[1] || '';
              const passHash = settings.cookie.match(/(?:^|;\s*)ipb_pass_hash=([^;]+)/i)?.[1] || '';
              const igneous = settings.cookie.match(/(?:^|;\s*)igneous=([^;]+)/i)?.[1] || '';
              const saveEh = (m: string, h: string, ig: string) => {
                const parts: string[] = [];
                if (m.trim()) parts.push(`ipb_member_id=${m.trim()}`);
                if (h.trim()) parts.push(`ipb_pass_hash=${h.trim()}`);
                if (ig.trim()) parts.push(`igneous=${ig.trim()}`);
                onUpdate({ cookie: parts.join('; ') });
              };
              const onField = (field: 'm' | 'h' | 'ig', raw: string) => {
                if (raw.includes('ipb_member_id=') && raw.includes('ipb_pass_hash=')) {
                  saveEh(
                    raw.match(/(?:^|;\s*)ipb_member_id=([^;]+)/i)?.[1] || '',
                    raw.match(/(?:^|;\s*)ipb_pass_hash=([^;]+)/i)?.[1] || '',
                    raw.match(/(?:^|;\s*)igneous=([^;]+)/i)?.[1] || igneous
                  );
                  return;
                }
                const clean = raw.trim().replace(/^(ipb_member_id|ipb_pass_hash|igneous)=/i, '').replace(/;+$/, '');
                if (field === 'm') saveEh(clean, passHash, igneous);
                else if (field === 'h') saveEh(memberId, clean, igneous);
                else saveEh(memberId, passHash, clean);
              };
              return (
                <div className="space-y-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      ipb_member_id
                    </label>
                    <input
                      type="text"
                      value={memberId}
                      onChange={(e) => onField('m', e.target.value)}
                      placeholder="只需粘贴值，例如 1234567"
                      className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      ipb_pass_hash
                    </label>
                    <input
                      type="text"
                      value={passHash}
                      onChange={(e) => onField('h', e.target.value)}
                      placeholder="只需粘贴 32 位字符串"
                      className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      igneous（选填，仅访问里站 ExHentai 需要）
                    </label>
                    <input
                      type="text"
                      value={igneous}
                      onChange={(e) => onField('ig', e.target.value)}
                      placeholder="不看里站可留空"
                      className="w-full rounded-xl border px-3 py-2 text-[13px] font-mono outline-none focus:ring-2 focus:ring-indigo-500/40"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)' }}
                    />
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 text-[14px] font-bold">
            <Network className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            后端代理地址（可选）
          </div>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            若运行服务的设备需要代理访问 E-Hentai，可填写 HTTP 代理，如{' '}
            <code>http://127.0.0.1:7890</code>
            {health?.envProxyConfigured ? '（检测到环境变量已配置代理）' : ''}
          </p>
          <input
            type="url"
            value={settings.proxyUrl}
            onChange={(e) => onUpdate({ proxyUrl: e.target.value })}
            placeholder="http://127.0.0.1:7890"
            className="mt-2.5 w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/40"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </div>

        <div className="p-4">
          <div className="flex items-center gap-2 text-[14px] font-bold">
            <Server className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            远程后端 API 地址（可选）
          </div>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            默认留空（使用当前同源服务）。若将前端部署在 GitHub Pages，可在此填入自托管后端或云端服务地址，如{' '}
            <code>https://your-eh-api.example.com</code>
          </p>
          <input
            type="url"
            value={settings.apiBaseUrl}
            onChange={(e) => onUpdate({ apiBaseUrl: e.target.value })}
            placeholder="留空则使用当前域名"
            className="mt-2.5 w-full rounded-xl border px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-indigo-500/40"
            style={{
              background: 'var(--bg-primary)',
              borderColor: 'var(--border-subtle)',
            }}
          />
        </div>
      </section>

      {/* Appearance & Reader */}
      <section className="ios-card overflow-hidden rounded-2xl divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="p-4">
          <div className="flex items-center gap-2 text-[14px] font-bold">
            <Moon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            外观主题
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                { id: 'system', label: '跟随系统' },
                { id: 'light', label: '浅色' },
                { id: 'dark', label: '深色' },
                { id: 'oled', label: '纯黑' },
              ] as { id: ThemeMode; label: string }[]
            ).map((opt) => {
              const active = settings.theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ theme: opt.id })}
                  className="rounded-xl py-2 text-[12px] font-semibold"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--bg-chip)',
                    color: active ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[14px] font-bold">默认阅读方向</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                { id: 'vertical', label: '竖屏滚动' },
                { id: 'ltr', label: '从左到右' },
                { id: 'rtl', label: '从右到左' },
              ] as { id: ReadingMode; label: string }[]
            ).map((opt) => {
              const active = settings.readingMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdate({ readingMode: opt.id })}
                  className="rounded-xl py-2 text-[12px] font-semibold"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--bg-chip)',
                    color: active ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-bold">图片预加载页数</div>
              <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                翻页与后台预载时提前缓存的后续页数（建议 10~15 页）
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[3, 5, 10, 15, 25].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onUpdate({ preloadCount: n })}
                className="rounded-xl py-2 text-[13px] font-semibold"
                style={{
                  background: settings.preloadCount === n ? 'var(--accent)' : 'var(--bg-chip)',
                  color: settings.preloadCount === n ? '#fff' : 'var(--text-primary)',
                }}
              >
                {n}页
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[14px] font-bold">长按保存菜单触发时间</div>
          <div className="mt-0.5 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
            调长可避免与 Safari 原生长按冲突；选「关闭」则仅使用 Safari 原生长按保存
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                { ms: 0, label: '关闭' },
                { ms: 600, label: '0.6 秒' },
                { ms: 1000, label: '1.0 秒' },
                { ms: 1500, label: '1.5 秒' },
              ] as const
            ).map((opt) => {
              const active = settings.longPressMs === opt.ms;
              return (
                <button
                  key={opt.ms}
                  type="button"
                  onClick={() => onUpdate({ longPressMs: opt.ms })}
                  className="rounded-xl py-2 text-[12px] font-semibold"
                  style={{
                    background: active ? 'var(--accent)' : 'var(--bg-chip)',
                    color: active ? '#fff' : 'var(--text-primary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 p-4">
          <div>
            <div className="text-[14px] font-bold">阅读时自动服务端后台预载</div>
            <div className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
              针对 E-Hentai：切到其他 App 或锁屏时，本机/AWS 后端仍会继续缓存后续图片
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoBgPreload}
            onClick={() => onUpdate({ autoBgPreload: !settings.autoBgPreload })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              settings.autoBgPreload ? 'bg-indigo-500' : 'bg-neutral-400/40'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                settings.autoBgPreload ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </section>

      {/* iOS PWA Installation Guide */}
      <section className="ios-card rounded-2xl p-4">
        <div className="flex items-center gap-2 text-[14px] font-bold">
          <Smartphone className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          在 iPhone / iPad 上安装为独立 App
        </div>
        <ol
          className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed"
          style={{ color: 'var(--text-secondary)' }}
        >
          <li>用 iPhone Safari 打开本页面地址（同一 Wi-Fi 下可使用下方局域网地址）。</li>
          <li>点击 Safari 底部工具栏的「分享」图标（方框带向上箭头）。</li>
          <li>向下滑动并选择「添加到主屏幕」，即可获得无地址栏的全屏原生 App 体验。</li>
        </ol>

        {health && health.lanUrls.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[12px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
              当前局域网访问地址：
            </div>
            {health.lanUrls.map((url) => (
              <div
                key={url}
                className="flex items-center justify-between rounded-xl px-3 py-2 text-[13px]"
                style={{ background: 'var(--bg-primary)' }}
              >
                <code className="truncate font-mono">{url}</code>
                <button
                  type="button"
                  onClick={() => copyText(url)}
                  className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  {copiedUrl === url ? (
                    <>
                      <Check className="h-3 w-3" /> 已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> 复制
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
