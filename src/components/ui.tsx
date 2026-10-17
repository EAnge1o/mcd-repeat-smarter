import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** 统一的类名拼接。只做过滤和空格连接，不引入 clsx 依赖。 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ 容器 */

/**
 * 只有两类容器：
 * - `layer="float"` 浮起来的一层（输入框、弹层）；
 * - `layer="panel"` 页面上的分栏块（白得虚，只有发丝线）。
 * 面板里不要再套面板 —— 嵌套卡片会把页面切成货架。
 */
export function Panel({
  children,
  className,
  layer = 'panel',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  layer?: 'panel' | 'float';
  as?: 'section' | 'div' | 'article' | 'aside';
}) {
  return <Tag className={cx('rounded-3xl', layer, className)}>{children}</Tag>;
}

/**
 * 栏目头：编号 + 衬线标题 + 一句口径说明。
 * 编号是装饰，但它让页面有段落顺序感 —— 比一排同样粗细的小标题好读。
 */
export function SectionHead({
  index,
  title,
  desc,
  action,
  className,
  size = 'md',
}: {
  index?: string;
  title: string;
  desc?: string;
  action?: ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {index ? <span className="eyebrow block">{index}</span> : null}
        <h2
          className={cx(
            'display mt-2.5 text-ink',
            size === 'sm' ? 'text-[20px] md:text-[22px]' : 'text-[24px] md:text-[29px]',
          )}
        >
          {title}
        </h2>
        {desc ? (
          /* ch 是等宽数字的宽度，中文里会低估一整行 —— 用 rem 定宽，
             再加 text-pretty 收住末行的孤字，避免一句说明被折成「核。」这种两字行 */
          <p className="mt-2 max-w-[30rem] text-pretty text-[12.5px] leading-[1.85] text-ink-mute">{desc}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 按钮 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  /* 主操作是墨色胶囊 + 一枚白色圆钮，品牌红只出现在圆钮里的箭头上 */
  primary: 'bg-ink text-white hover:bg-[#3a312c]',
  secondary: 'bg-white/70 text-ink ring-1 ring-inset ring-line backdrop-blur-sm hover:bg-white',
  ghost: 'text-ink-soft hover:bg-white/70',
  danger: 'bg-white/70 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3.5 text-[12px]',
  md: 'h-10 gap-2 px-[18px] text-[12.5px]',
  lg: 'h-11 gap-2 px-5 text-[13px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  arrow = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; arrow?: boolean }) {
  const withKnob = arrow && variant === 'primary';
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        'transition-[background-color,color,box-shadow,transform] duration-200 ease-out',
        'active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100',
        VARIANT[variant],
        SIZE[size],
        withKnob && 'pr-1.5',
        className,
      )}
    >
      {children}
      {withKnob ? (
        <span className="ml-1 grid h-7 w-7 place-items-center rounded-full bg-white text-brand-600" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </button>
  );
}

/* ------------------------------------------------------------------ 标记 */

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'brand';

const TONE: Record<Tone, string> = {
  neutral: 'bg-[#f3efea] text-ink-soft',
  ok: 'bg-sage text-[#3f6b52]',
  warn: 'bg-butter text-[#7a5a1c]',
  danger: 'bg-brand-50 text-brand-700',
  brand: 'bg-brand-50 text-brand-700',
};

/**
 * 标记用小写字母 + mono，字距拉开。
 * 全大写会给中文带来一种「标签贴纸」感，这里只要一个安静的分类角标。
 */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9.5px] leading-[1.6] tracking-[0.1em]',
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
  info: { box: 'bg-white/70 text-ink-soft ring-line', title: 'text-ink' },
  ok: { box: 'bg-sage text-[#3f6b52] ring-[#d9e8de]', title: 'text-[#2f5641]' },
  warn: { box: 'bg-butter text-[#7a5a1c] ring-[#f0e2c4]', title: 'text-[#634716]' },
  error: { box: 'bg-brand-50 text-brand-700 ring-[#f2d3ce]', title: 'text-[#8f170d]' },
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
    <div
      className={cx('rounded-2xl px-4 py-3.5 text-[12.5px] leading-relaxed ring-1', t.box, className)}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <div className={cx('font-medium', t.title)}>{title}</div>
      {children ? <div className="mt-1.5 opacity-90">{children}</div> : null}
      {hint ? <div className="mt-1.5 text-[11.5px] opacity-70">{hint}</div> : null}
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
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-5 py-10' : 'px-6 py-16')}>
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-white/80 ring-1 ring-line" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#736a61" strokeWidth="1.3" strokeLinecap="round">
          <path d="M4 8h16M4 13h11M4 18h7" />
        </svg>
      </span>
      <p className="display text-[17px] text-ink">{title}</p>
      {desc ? <p className="mt-2 max-w-[26rem] text-pretty text-[12px] leading-[1.85] text-ink-mute">{desc}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 统计 */

/**
 * 编辑式统计条里的一格：标签在上、衬线数字在下、口径说明垫底。
 * 数字用衬线是这个版式最重要的一个决定 —— 无衬线大数字像报表，衬线数字像刊物。
 */
export function Stat({
  label,
  value,
  unit,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: 'brand';
  className?: string;
}) {
  return (
    <div className={cx('min-w-0', className)}>
      <p className="eyebrow truncate">{label}</p>
      <p className="mt-2.5 flex items-baseline gap-1.5">
        <span
          className={cx('tnum display truncate text-[30px] leading-none md:text-[34px]', tone === 'brand' ? 'text-brand-600' : 'text-ink')}
        >
          {value}
        </span>
        {unit ? <span className="shrink-0 font-mono text-[10px] tracking-[0.08em] text-ink-faint">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-2 truncate text-[10.5px] text-ink-faint" title={hint}>{hint}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 其他 */

/** 涨跌指示。颜色只做辅助，箭头和正负号本身已经表达了方向（不靠颜色单独传递状态）。 */
export function TrendPill({ dir, text }: { dir: 'up' | 'down' | 'flat'; text: string }) {
  const map = {
    up: { color: 'text-[#3f6b52]', arrow: 'M6 14l5-5 3 3 6-6' },
    down: { color: 'text-brand-700', arrow: 'M6 8l5 5 3-3 6 6' },
    flat: { color: 'text-[#7a5a1c]', arrow: 'M6 12h12' },
  }[dir];

  return (
    <span className={cx('inline-flex items-center gap-1 font-mono text-[10px] tracking-[0.04em]', map.color)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col items-center gap-2 px-5">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx(
            'animate-fade-up rounded-full px-4 py-2 text-[12px] font-medium shadow-float ring-1',
            t.kind === 'error' ? 'bg-[#2a1310] text-[#ffe6e3] ring-white/10' : 'bg-ink text-white ring-white/10',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
