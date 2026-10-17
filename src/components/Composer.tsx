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
 * 用 focus-within 给整个浮层描边，而不是只给 textarea：输入时用户感知的是「我在这一层里」，
 * 边框只画在文本框上会让底部那排快捷短语看起来是独立控件。
 * 发送键是一个墨色圆钮，不用方块 —— 圆钮在这么空的版式里才不像按钮贴纸。
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
  const [focused, setFocused] = useState(false);
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

  const active = Boolean(value.trim()) && !loading && !disabled;

  return (
    <div
      className={cx(
        'float rounded-2xl transition-[box-shadow,ring] duration-300 ease-out',
        focused && 'ring-1 ring-brand-400/80',
        className,
      )}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
          'block w-full resize-none bg-transparent text-[13.5px] leading-[1.85] text-ink outline-none',
          'placeholder:text-ink-faint disabled:text-ink-faint',
          compact ? 'px-5 pt-3.5 pb-1' : 'px-6 pt-5 pb-1.5 md:text-[14.5px]',
        )}
      />

      <div className={cx('flex items-end justify-between gap-3', compact ? 'px-2.5 pb-2.5' : 'px-2.5 pb-2.5 md:px-3.5 md:pb-3.5')}>
        {quickPrompts.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1.5">
            <span className="eyebrow shrink-0 pl-2">试着说</span>
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setValue(p);
                  ref.current?.focus();
                }}
                disabled={disabled || loading}
                className="shrink-0 whitespace-nowrap rounded-full bg-[#f6f1ec] px-3 py-1 text-[11px] text-ink-soft transition-[background-color,color,transform] duration-200 ease-out hover:bg-white hover:text-ink active:scale-[0.97] disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          <span className="eyebrow shrink-0 pb-2.5 pl-2">Enter 发送 · Shift 换行</span>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!active}
          aria-label="开始调整"
          className={cx(
            'grid shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 ease-out active:scale-[0.94]',
            compact ? 'h-9 w-9' : 'h-10 w-10',
            active ? 'bg-ink text-white hover:bg-[#3a312c]' : 'cursor-not-allowed bg-[#e9e3dd] text-[#b6ada4]',
          )}
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
          ) : (
            <IconSend size={compact ? 14 : 15} />
          )}
        </button>
      </div>
    </div>
  );
}
