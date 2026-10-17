import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** 统一的类名拼接。只做过滤和空格连接，不引入 clsx 依赖。 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ 容器 */

/**
 * 只有两类容器：
 * - `layer="float"` 真正浮起来的一层（输入框、弹层），有一枚投影；
 * - `layer="panel"` 页面上的分栏块，只比底色亮半档。
 *
 * 面板里不要再套面板 —— 嵌套卡片会把页面切成货架，也让「哪里是主体」变得不清楚。
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
  return <Tag className={cx('rounded-2xl', layer, className)}>{children}</Tag>;
}

/**
 * 栏目头：标题 + 一句必要的口径说明。
 *
 * 说明文字是可选项 —— 大部分栏目不需要解释自己，硬塞一句说明只会让页面变密。
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
            'display text-ink',
            size === 'sm' ? 'mt-1.5 text-[19px] md:text-[21px]' : 'text-[23px] md:text-[27px]',
          )}
        >
          {title}
        </h2>
        {desc ? <p className="mt-2 max-w-[30rem] text-pretty text-[12.5px] leading-[1.8] text-ink-mute">{desc}</p> : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 按钮 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  /*
   * 主操作是品牌红 —— 全站唯一大面积用红的地方。
   * 基态用 brand-600 而不是 500：白字在 500 上只有 4.87:1，落在 AA 边缘；
   * 600 是 5.96:1，按钮这种「必须看清的动作」不该在及格线上晃。
   */
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700',
  secondary: 'bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-wash hover:text-ink',
  ghost: 'text-ink-mute hover:bg-wash hover:text-ink',
  danger: 'bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3.5 text-[12px]',
  md: 'h-10 gap-2 px-5 text-[13px]',
  lg: 'h-11 gap-2 px-6 text-[13.5px]',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-medium',
        'transition-[background-color,color,box-shadow,transform] duration-150 ease-out',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
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
  neutral: 'bg-wash text-ink-mute',
  ok: 'bg-sage text-[#3d6a52]',
  warn: 'bg-butter text-[#77571d]',
  danger: 'bg-brand-50 text-brand-700',
  brand: 'bg-brand-50 text-brand-700',
};

/**
 * 标记。只有在真的要分类时才用 —— 一屏里超过三枚标记，就说明信息没想清楚，
 * 应该拆成组而不是贴标签。
 */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-[10.5px] leading-[1.6]', TONE[tone], className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ 提示 */

const ALERT: Record<'info' | 'ok' | 'warn' | 'error', { box: string; title: string }> = {
  info: { box: 'bg-white text-ink-soft ring-line', title: 'text-ink' },
  ok: { box: 'bg-sage text-[#3d6a52] ring-[#d5e5da]', title: 'text-[#2e5740]' },
  warn: { box: 'bg-butter text-[#77571d] ring-[#eee0c2]', title: 'text-[#5f4415]' },
  error: { box: 'bg-brand-50 text-brand-700 ring-[#f1d2cd]', title: 'text-[#8c160c]' },
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
      className={cx('rounded-xl px-4 py-3.5 text-[12.5px] leading-relaxed ring-1', t.box, className)}
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
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-5 py-9' : 'px-6 py-14')}>
      <p className="display text-[17px] text-ink">{title}</p>
      {desc ? <p className="mt-2 max-w-[26rem] text-pretty text-[12.5px] leading-[1.8] text-ink-mute">{desc}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 指标 */

/**
 * 指标排版。**不给单项套卡片** —— 卡片边界不携带信息，只会把注意力切成四份。
 *
 * 只有一个主角（`lead`）：它用衬线放大到能一眼看到。其余用 `rest` 排成一行次级信息，
 * 靠字重和颜色退后，而不是靠格子退后。
 */
export function MetricLead({
  label,
  value,
  unit,
  note,
  loading,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div>
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-3 h-9 w-40" />
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="tnum display text-[34px] leading-none text-ink md:text-[42px]">{value}</span>
        {unit ? <span className="text-[12px] text-ink-mute">{unit}</span> : null}
      </p>
      {note ? <p className="mt-2.5 text-[12px] leading-relaxed text-ink-mute">{note}</p> : null}
    </div>
  );
}

/** 次级指标：横向排布的一串小数字，无格子无竖线。 */
export function MetricPair({
  items,
  loading,
}: {
  items: { label: string; value: string }[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="eyebrow">{it.label}</dt>
          <dd className="tnum mt-1.5 text-[15px] leading-none text-ink-soft">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ 其他 */

/** 涨跌指示。方向同时由箭头和正负号表达，不靠颜色单独传递状态。 */
export function TrendPill({ dir, text }: { dir: 'up' | 'down' | 'flat'; text: string }) {
  const map = {
    up: { color: 'text-[#3d6a52]', arrow: 'M6 14l5-5 3 3 6-6' },
    down: { color: 'text-brand-700', arrow: 'M6 8l5 5 3-3 6 6' },
    flat: { color: 'text-ink-mute', arrow: 'M6 12h12' },
  }[dir];

  return (
    <span className={cx('tnum inline-flex items-center gap-1 text-[11.5px]', map.color)}>
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
            'animate-fade-up rounded-lg px-4 py-2 text-[12.5px] font-medium shadow-float',
            t.kind === 'error' ? 'bg-[#2a1310] text-[#ffe6e3]' : 'bg-ink text-white',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
