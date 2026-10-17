import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** 统一的类名拼接。只做过滤和空格连接，不引入 clsx 依赖。 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ 卡片 */

export function Card({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={cx('rounded-xl border border-line bg-white shadow-card', className)}>{children}</Tag>;
}

export function CardHead({
  title,
  desc,
  action,
  className,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 border-b border-line px-4 py-3 md:px-5', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold tracking-tight text-[#111827] md:text-[15px]">{title}</h2>
        {desc ? <p className="mt-0.5 truncate text-xs text-[#6f6a62]">{desc}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 按钮 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:hover:bg-brand-500',
  secondary: 'bg-[#f2f0ec] text-[#3d3a35] hover:bg-[#e8e5df]',
  ghost: 'text-[#4b4945] hover:bg-[#f2f0ec]',
  danger: 'bg-white text-[#b3261e] border border-[#f0d6d3] hover:bg-[#fdf3f2]',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 ease-out',
        'active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ 标记 */

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brand';

const TONE: Record<Tone, string> = {
  neutral: 'bg-[#f2f0ec] text-[#5c5850]',
  ok: 'bg-[#e9f7ef] text-[#1d7a45]',
  warn: 'bg-[#fdf4e3] text-[#8a5a00]',
  danger: 'bg-[#fdecea] text-[#a4231a]',
  brand: 'bg-brand-50 text-brand-700',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ 提示 */

const ALERT: Record<'info' | 'ok' | 'warn' | 'error', { box: string; title: string }> = {
  info: { box: 'border-[#dbe6f5] bg-[#f4f8fd] text-[#1f3f66]', title: 'text-[#16324f]' },
  ok: { box: 'border-[#cfe9da] bg-[#f2fbf6] text-[#1c5c3b]', title: 'text-[#134a2e]' },
  warn: { box: 'border-[#f2e2c2] bg-[#fdf8ee] text-[#6d4c11]', title: 'text-[#5b3e0b]' },
  error: { box: 'border-[#f3d3cf] bg-[#fdf4f3] text-[#7d2a23]', title: 'text-[#6d221c]' },
};

export function Alert({
  kind = 'info',
  title,
  hint,
  children,
  className,
}: {
  kind?: 'info' | 'ok' | 'warn' | 'error';
  title: string;
  hint?: string;
  children?: ReactNode;
  className?: string;
}) {
  const t = ALERT[kind];
  return (
    <div className={cx('rounded-lg border px-3.5 py-3 text-xs leading-relaxed', t.box, className)} role={kind === 'error' ? 'alert' : 'status'}>
      <div className={cx('font-semibold', t.title)}>{title}</div>
      {children ? <div className="mt-1">{children}</div> : null}
      {hint ? <div className="mt-1 opacity-75">{hint}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 状态 */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />;
}

export function EmptyState({
  title,
  desc,
  action,
  compact = false,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f0ec]" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6f6a62" strokeWidth="1.6" strokeLinecap="round">
          <path d="M4 7h16M4 12h10M4 17h7" />
        </svg>
      </div>
      <p className="text-sm font-medium text-[#3d3a35]">{title}</p>
      {desc ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-[#6f6a62]">{desc}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 其他 */

/** 涨跌指示。颜色只做辅助，箭头和正负号本身已经表达了方向（不靠颜色单独传递状态）。 */
export function TrendPill({ dir, text }: { dir: 'up' | 'down' | 'flat'; text: string }) {
  const map = {
    up: { color: 'text-[#1d7a45]', arrow: 'M6 14l5-5 3 3 6-6' },
    down: { color: 'text-[#b3261e]', arrow: 'M6 8l5 5 3-3 6 6' },
    flat: { color: 'text-[#8a5a00]', arrow: 'M6 12h12' },
  }[dir];

  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-medium', map.color)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={map.arrow} />
      </svg>
      {text}
    </span>
  );
}

/* ------------------------------------------------------------------ 轻提示 */

export interface ToastItem {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

export function Toasts({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'animate-fade-up rounded-lg px-3.5 py-2 text-xs font-medium text-white shadow-lift',
            t.kind === 'error' ? 'bg-[#b3261e]' : 'bg-[#241d1a]',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
