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
 * 这是一块**实体物**：3px 纯黑描边 + 一枚不散的硬阴影，像压在柜台台面上的一张点餐卡。
 * 上一版用的是 `.float`（白底 + 2px 淡描边 + 28px 弥散投影），那是日系精品店的玻璃语法，
 * 放到麦当劳语境里会显得「软」—— 美式快餐的卡片永远是硬的、有黑边的、能按下去的。
 *
 * 快捷短语不给半透明灰底（灰是上一版残留），改用**黑边白底的小标签**，
 * 悬停翻成金黄实底 —— 这才是菜单上贴分类签的做法。
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

  const active = Boolean(value.trim()) && !loading && !disabled;

  return (
    <div className={cx('composer', className)}>
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
          'block w-full resize-none bg-transparent font-bold text-ink outline-none',
          'placeholder:font-medium placeholder:text-ink-faint disabled:text-ink-faint',
          compact ? 'px-5 pt-4 pb-1 text-[13.5px]' : 'px-7 pt-6 pb-2 text-[16px] leading-[1.75] md:text-[17px]',
        )}
      />

      <div
        className={cx(
          'flex items-end justify-between gap-3',
          compact ? 'px-2.5 pb-2.5' : 'px-3 pb-3 md:px-4 md:pb-4',
        )}
      >
        {quickPrompts.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {/*
              标签与快捷按钮同形状同高度，唯一区别是**没有那枚硬阴影**——
              阴影在这个设计语言里就是「可按」的信号，去掉它就分得清谁是提示、谁是按钮。
            */}
            <span className="composer__label shrink-0 px-2.5 py-1.5 text-[13px] font-black">
              试试说
            </span>
            {quickPrompts.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  setValue(p);
                  ref.current?.focus();
                }}
                disabled={disabled || loading}
                className="composer__chip shrink-0 whitespace-nowrap px-3 py-1.5 text-[13px] font-bold"
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          <span className="shrink-0 pb-2.5 pl-1 text-[11.5px] font-bold text-ink-faint">
            Enter 发送 · Shift 换行
          </span>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!active}
          aria-label="开始调整"
          className={cx(
            'composer__send grid shrink-0 place-items-center',
            compact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          {loading ? (
            <span
              className={cx(
                'animate-spin-slow rounded-full border-2 border-white/35 border-t-white',
                compact ? 'h-3.5 w-3.5' : 'h-4 w-4',
              )}
              aria-hidden="true"
            />
          ) : (
            <IconSend size={compact ? 15 : 19} />
          )}
        </button>
      </div>
    </div>
  );
}