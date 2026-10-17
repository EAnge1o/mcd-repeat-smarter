import { useEffect, useRef, useState } from 'react';
import { IconSend, IconSparkle } from './Icons';

interface ComposerProps {
  onSubmit: (text: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  quickPrompts?: string[];
  initialValue?: string;
}

export function Composer({
  onSubmit,
  loading = false,
  disabled = false,
  placeholder = '还是上次那份，不过今天不要香芋派，预算不超过 16 元',
  quickPrompts = [],
  initialValue = '',
}: ComposerProps) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // 自适应高度
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const submit = () => {
    const text = value.trim();
    if (!text || loading || disabled) return;
    onSubmit(text);
  };

  return (
    <div className="composer">
      <div className="composer__row">
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

      {quickPrompts.length > 0 && (
        <div className="quick-row">
          <span className="quick-row__label">
            <IconSparkle size={12} />
            试着说
          </span>
          {quickPrompts.map((p) => (
            <button key={p} type="button" className="chip" onClick={() => setValue(p)} disabled={disabled || loading}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
