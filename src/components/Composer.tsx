import { useEffect, useRef, useState } from 'react';
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
}

/**
 * 一句话输入区 —— 全站唯一的主入口。
 *
 * 结构：一个干净的输入面板（输入域 + 底部一行快捷短语 + 圆形发送键）。
 * 快捷短语做成小胶囊而不是文字链：这里需要被「看见」，
 * 而文字链在首屏会被误认为脚注。胶囊最多四个，超出横向滚动。
 */
export function Composer({
  onSubmit,
  loading = false,
  disabled = false,
  placeholder = '还是上次那份，不过今天不要香芋派，预算不超过 16 元',
  quickPrompts = [],
  initialValue = '',
  compact = false,
}: ComposerProps) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // 自适应高度：上限 168px，超过后内部滚动，避免把首屏撑开
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
    <div className={compact ? 'composer composer--compact' : 'composer'}>
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
      />

      <div className="composer__foot">
        {quickPrompts.length > 0 ? (
          <>
            <span className="composer__hint">试着说</span>
            <div className="composer__chips">
              {quickPrompts.map((p) => (
                <button key={p} type="button" className="chip" onClick={() => setValue(p)} disabled={disabled || loading}>
                  {p}
                </button>
              ))}
            </div>
          </>
        ) : (
          <span className="composer__note">Enter 发送 · Shift + Enter 换行</span>
        )}

        <button
          type="button"
          className="composer__send"
          onClick={submit}
          disabled={!value.trim() || loading || disabled}
          aria-label="开始调整"
        >
          {loading ? <div className="spinner" /> : <IconSend />}
        </button>
      </div>
    </div>
  );
}
