import { useEffect, useRef, useState } from 'react';
import { cx } from './ui';
import { IconSend } from './Icons';

interface ComposerProps {
  onSubmit: (text: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  quickPrompts?: string[];
  initialValue?: string;
  /** 结果页上的「接着说」用紧凑版：只做补充指令，不抢结论的注意力 */
  compact?: boolean;
  className?: string;
}

/**
 * 一句话输入区 —— 全站唯一的主入口。
 *
 * 用 focus-within 给整个面板描边，而不是只给 textarea：输入时用户感知的是「我在这个框里」，
 * 边框只画在文本框上会让底部那行快捷短语看起来是独立控件。
 */
export function Composer({
  onSubmit,
  loading = false,
  disabled = false,
  placeholder = '还是上次那份，不过今天不要香芋派，预算不超过 16 元',
  quickPrompts = [],
  initialValue = '',
  compact = false,
  className,
}: ComposerProps) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // 自适应高度：上限 168px，超过后内部滚动
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || loading || disabled) return;
    onSubmit(text);
  };

  return (
    <div
      className={cx(
        'rounded-xl border border-line bg-white shadow-card transition-all duration-150 ease-out',
        'focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/15',
        className,
      )}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label="用一句话说明你这次想怎么改"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        className={cx(
          'block w-full resize-none bg-transparent px-4 text-sm leading-relaxed text-[#111827] outline-none placeholder:text-[#7a756c] disabled:text-[#8a877f]',
          compact ? 'pt-3 pb-2' : 'pt-3.5 pb-2.5',
        )}
      />

      <div className="flex items-center gap-2 border-t border-line px-2 py-2">
        {quickPrompts.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="shrink-0 pl-1 text-[11px] text-[#6f6a62]">试着说</span>
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setValue(p);
                  ref.current?.focus();
                }}
                disabled={disabled || loading}
                className="shrink-0 whitespace-nowrap rounded-md bg-[#f7f6f3] px-2 py-1 text-[11px] text-[#5c5850] transition-colors duration-150 hover:bg-[#eeece8] hover:text-[#111827] active:scale-[0.97] disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          <span className="flex-1 pl-2 text-[11px] text-[#6f6a62]">Enter 发送 · Shift + Enter 换行</span>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || loading || disabled}
          aria-label="开始调整"
          className={cx(
            'grid shrink-0 place-items-center rounded-lg transition-all duration-150 ease-out active:scale-[0.94]',
            compact ? 'h-8 w-8' : 'h-9 w-9',
            value.trim() && !loading && !disabled
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'cursor-not-allowed bg-[#f2f0ec] text-[#c0bcb4]',
          )}
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
          ) : (
            <IconSend size={compact ? 15 : 16} />
          )}
        </button>
      </div>
    </div>
  );
}
