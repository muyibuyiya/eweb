import React from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { EH_CATEGORIES } from '../../shared/types';

interface CategoryFilterSheetProps {
  open: boolean;
  excludedMask: number;
  onChangeMask: (mask: number) => void;
  onQuickTag: (tag: string) => void;
  onClose: () => void;
}

const QUICK_TAGS = [
  { label: '中文翻译', query: 'language:chinese$' },
  { label: '日语原版', query: 'language:japanese$' },
  { label: '英语', query: 'language:english$' },
  { label: '全彩', query: 'other:"full color"$' },
  { label: '单行本', query: 'other:tankoubon$' },
  { label: '画集', query: 'other:artbook$' },
];

export const CategoryFilterSheet: React.FC<CategoryFilterSheetProps> = ({
  open,
  excludedMask,
  onChangeMask,
  onQuickTag,
  onClose,
}) => {
  if (!open) return null;

  const toggleCategory = (bit: number) => {
    onChangeMask(excludedMask ^ bit);
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
          <h2 className="text-[17px] font-bold">分类与快捷筛选</h2>
          <div className="flex items-center gap-2">
            {excludedMask > 0 && (
              <button
                type="button"
                onClick={() => onChangeMask(0)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium"
                style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)' }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                重置
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: 'var(--bg-chip)' }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-1 text-[12px]" style={{ color: 'var(--text-secondary)' }}>
          点击切换显示的画廊分类（灰色表示已隐藏）
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {EH_CATEGORIES.map((cat) => {
            const isEnabled = (excludedMask & cat.bit) === 0;
            return (
              <button
                key={cat.name}
                type="button"
                onClick={() => toggleCategory(cat.bit)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all active:scale-95"
                style={{
                  background: isEnabled ? cat.color : 'var(--bg-chip)',
                  color: isEnabled ? '#ffffff' : 'var(--text-secondary)',
                  opacity: isEnabled ? 1 : 0.65,
                }}
              >
                <span>
                  {cat.labelZh}{' '}
                  <span className="text-[11px] font-normal opacity-80">{cat.name}</span>
                </span>
                {isEnabled && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            快捷标签搜索
          </h3>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {QUICK_TAGS.map((t) => (
              <button
                key={t.query}
                type="button"
                onClick={() => {
                  onQuickTag(t.query);
                  onClose();
                }}
                className="rounded-full px-3 py-1.5 text-[12px] font-medium active:scale-95 transition-transform"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                # {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl py-3 text-[15px] font-semibold text-white active:scale-[0.98] transition-transform"
          style={{ background: 'var(--accent)' }}
        >
          应用筛选
        </button>
      </div>
    </div>
  );
};
