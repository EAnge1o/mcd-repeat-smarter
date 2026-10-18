import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** 统一的类名拼接。只做过滤和空格连接，不引入 clsx 依赖。 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ 容器 */

/**
 * 只有两类容器：
 * - `layer="float"` 真正浮起来的一层（输入框、弹层），有硬阴影；
 * - `layer="panel"` 页面上的分栏块，纯白卡片 + 实线描边。
 *
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
  return <Tag className={cx('rounded-2xl', layer, className)}>{children}</Tag>;
}

/**
 * 栏目头：黄色分类标签 + 超重黑体标题 + 一句口径说明。
 *
 * 标签是实心黄胶囊而不是灰色小字 —— 这是麦当劳菜单分类的做法。
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
        {index ? <span className="eyebrow mb-2.5">{index}</span> : null}
        <h2
          className={cx(
            'display text-ink',
            size === 'sm' ? 'display-24' : 'display-24 md:display-36',
          )}
        >
          {title}
        </h2>
        {desc ? <p className="mt-2.5 max-w-[30rem] text-pretty text-[13.5px] leading-[1.8] text-ink-mute">{desc}</p> : null}
      </div>
      {action ? <div className="shrink-0 pb-0.5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 按钮 */

type Variant = 'primary' | 'secondary' | 'gold' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/*
 * 麦当劳的按钮有一个关键特征：**按下去会陷进去**。
 * 不是阴影变淡，而是整块往下位移、下方的实心阴影露出 3px ——
 * 这个「实体按键」的反馈是它区别于普通 SaaS 按钮的核心手感。
 */
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-brand-press hover:bg-brand-600 active:translate-y-[3px] active:shadow-none',
  secondary:
    'bg-white text-ink shadow-[0_3px_0_rgba(13,13,13,0.16)] ring-2 ring-ink/12 hover:bg-gold-100 active:translate-y-[3px] active:shadow-none',
  gold: 'bg-gold-400 text-ink shadow-[0_3px_0_rgba(154,106,0,1)] hover:bg-gold-300 active:translate-y-[3px] active:shadow-none',
  ghost: 'text-ink-soft hover:bg-ink/6 hover:text-ink',
  danger: 'bg-white text-brand-600 shadow-[0_3px_0_rgba(163,24,16,0.3)] ring-2 ring-brand-200 hover:bg-brand-50 active:translate-y-[3px] active:shadow-none',
};

const SIZE: Record<Size, string> = {
  sm: 'h-9 gap-1.5 px-4 text-[13px]',
  md: 'h-11 gap-2 px-6 text-[14px]',
  lg: 'h-13 gap-2.5 px-7 text-[15px] py-3',
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
        // 药丸形是麦当劳数字产品的签名形状
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        'transition-[background-color,color,box-shadow,transform] duration-100 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0',
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
  neutral: 'bg-ink/8 text-ink-soft',
  ok: 'bg-sage text-[#2e6b41]',
  warn: 'bg-gold-200 text-[#7a5600]',
  danger: 'bg-brand-500 text-white',
  brand: 'bg-gold-400 text-ink',
};

/**
 * 标记。只有在真的要分类时才用 —— 一屏里超过三枚标记，就说明信息没想清楚。
 */
export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-bold leading-[1.7]', TONE[tone], className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ 提示 */

const ALERT: Record<'info' | 'ok' | 'warn' | 'error', { box: string; title: string }> = {
  info: { box: 'bg-white text-ink-soft ring-ink/12', title: 'text-ink' },
  ok: { box: 'bg-sage text-[#2e6b41] ring-[#bcd8c4]', title: 'text-[#255636]' },
  warn: { box: 'bg-gold-100 text-[#7a5600] ring-[#e8cf8a]', title: 'text-[#5e4200]' },
  error: { box: 'bg-brand-500 text-white ring-brand-700', title: 'text-white' },
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
      className={cx('rounded-2xl px-5 py-4 text-[13.5px] leading-relaxed ring-2', t.box, className)}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      <div className={cx('font-bold', t.title)}>{title}</div>
      {children ? <div className="mt-1.5 opacity-90">{children}</div> : null}
      {hint ? <div className="mt-1.5 text-[13px] opacity-70">{hint}</div> : null}
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
      {/* 空状态用金拱门。这是麦当劳最强的形状资产，出现在空状态正好合适 */}
      <span
        className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-gold-400"
        aria-hidden="true"
      >
        <svg width="30" height="29" viewBox="0 0 104 100" fill="none">
          <path
            d="M13 92V66C13 37 23.9 8 32.5 8S52 37 52 66V92C52 37 60.6 8 71.5 8S91 37 91 66V92"
            stroke="#0d0d0d"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="display display-24 text-ink">{title}</p>
      {desc ? <p className="mt-2 max-w-[26rem] text-pretty text-[13.5px] leading-[1.8] text-ink-mute">{desc}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ 指标 */

/**
 * 指标排版。**不给单项套卡片** —— 卡片边界不携带信息。
 *
 * 主角用超重黑体 + 品牌红放大到一眼可见；其余退成一行次级信息。
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
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="mt-3 h-11 w-44" />
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="mt-2.5 flex items-baseline gap-2">
        <span className="tnum display display-48 text-brand-600">{value}</span>
        {unit ? <span className="text-[13px] font-bold text-ink-mute">{unit}</span> : null}
      </p>
      {note ? <p className="mt-3 text-[13px] leading-relaxed text-ink-mute">{note}</p> : null}
    </div>
  );
}

/** 次级指标：横向排布的一串小数字，胶囊标签 + 粗黑数字。 */
export function MetricPair({
  items,
  loading,
}: {
  items: { label: string; value: string }[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-white px-4 py-3 ring-2 ring-ink/10">
            <Skeleton className="h-2.5 w-12" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="flex flex-wrap gap-x-3 gap-y-3">
      {items.map((it) => (
        <div key={it.label} className="rounded-2xl bg-white px-4 py-2.5 ring-2 ring-ink/10">
          <dt className="text-[11.5px] font-bold uppercase tracking-wider text-ink-faint">{it.label}</dt>
          <dd className="tnum mt-1 text-[17px] font-black leading-none text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ 其他 */

/** 涨跌指示。方向同时由箭头和正负号表达，不靠颜色单独传递状态。 */
export function TrendPill({ dir, text }: { dir: 'up' | 'down' | 'flat'; text: string }) {
  const map = {
    up: { color: 'text-[#2e6b41]', arrow: 'M6 14l5-5 3 3 6-6' },
    down: { color: 'text-brand-600', arrow: 'M6 8l5 5 3-3 6 6' },
    flat: { color: 'text-ink-mute', arrow: 'M6 12h12' },
  }[dir];

  return (
    <span className={cx('tnum inline-flex items-center gap-1 text-[13px] font-bold', map.color)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
            'animate-fade-up rounded-full px-5 py-2.5 text-[13.5px] font-bold text-white shadow-float',
            t.kind === 'error' ? 'bg-brand-600' : 'bg-ink',
          )}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
