import { useMemo, useState } from 'react';
import { cx, EmptyState } from './ui';

export interface Bucket {
  key: string;
  label: string;
  range: string;
  count: number;
}

const R = 70;
const C = 2 * Math.PI * R;

/**
 * 下单时段分布。用环形而不是饼图：中心可以放总数，外环也更容易读出单段占比。
 * 没有订单时不画空环，直接给空状态 —— 空环看起来像「数据加载失败」。
 *
 * 配色按「实际有数据的分段」分配，而不是按分桶索引：只有两段有数据时，
 * 如果按索引取色会拿到两个几乎一样的深红，区分不出来。
 */
export function HourDonut({ buckets }: { buckets: Bucket[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = buckets.reduce((n, b) => n + b.count, 0);

  const palette = useMemo(() => {
    const nonZero = buckets.filter((b) => b.count > 0).length;
    if (nonZero <= 2) return ['#da291c', '#f0b3aa'];
    if (nonZero === 3) return ['#a31a0f', '#da291c', '#f2a89f'];
    return ['#8f170d', '#c31f13', '#da291c', '#e2665a', '#f0a79e'];
  }, [buckets]);

  const colored = useMemo(() => {
    let i = 0;
    return buckets.map((b) => {
      const color = b.count > 0 ? palette[i++ % palette.length] : '#e6e3de';
      return { ...b, color };
    });
  }, [buckets, palette]);

  if (total === 0) {
    return (
      <EmptyState compact title="还没有下单时段可统计" desc="读到的历史订单里没有可解析的下单时间，或者订单数为 0。" />
    );
  }

  let cursor = 0;
  const segments = colored
    .filter((b) => b.count > 0)
    .map((b) => {
      const frac = b.count / total;
      const seg = { ...b, frac, offset: cursor };
      cursor += frac;
      return seg;
    });

  return (
    <div className="flex w-full flex-col items-center gap-3 px-4 py-3.5 md:px-5">
      <div className="relative aspect-square w-full max-w-[132px] shrink-0">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" role="img" aria-label="下单时段分布">
          <circle cx="100" cy="100" r={R} fill="none" stroke="#f2f0ec" strokeWidth="20" />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx="100"
              cy="100"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth={active && active !== s.key ? 15 : 20}
              strokeDasharray={`${(s.frac * C).toFixed(2)} ${(C - s.frac * C).toFixed(2)}`}
              strokeDashoffset={-(s.offset * C)}
              strokeLinecap="butt"
              className="cursor-pointer transition-all duration-150 ease-out"
              onMouseEnter={() => setActive(s.key)}
              onMouseLeave={() => setActive(null)}
            />
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-[23px] font-semibold leading-none tracking-tight text-[#111827]">{total}</span>
          <span className="mt-1 text-[10px] text-[#6f6a62]">单</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1">
        {colored.map((b) => {
          const pct = Math.round((b.count / total) * 100);
          return (
            <li
              key={b.key}
              onMouseEnter={() => setActive(b.key)}
              onMouseLeave={() => setActive(null)}
              className={cx(
                'flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] transition-colors duration-150',
                active === b.key ? 'bg-[#faf9f7]' : '',
              )}
            >
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: b.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-[#4b4945]">{b.label}</span>
              <span className="tnum w-10 shrink-0 text-right text-[10px] text-[#b3afa7]">{b.range}</span>
              <span className="tnum w-5 shrink-0 text-right text-[#111827]">{b.count}</span>
              <span className="tnum w-8 shrink-0 text-right text-[10px] text-[#6f6a62]">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
