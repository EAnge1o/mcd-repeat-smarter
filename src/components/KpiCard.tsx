import type { ReactNode } from 'react';
import { cx, Skeleton, TrendPill } from './ui';
import type { Kpi } from '../lib/metrics';

/**
 * KPI 卡。数字是主角，所以：标签在上、数字最大、口径说明在数字下面一行小字。
 * hover 时整卡轻微上浮、数字微放大（stylekit 的 KPI Focus），但位移只有 2px，
 * 数据面板多的时候大面积浮动会显得页面在漂。
 */
export function KpiCard({ kpi, icon }: { kpi: Kpi; icon?: ReactNode }) {
  return (
    <article className="group rounded-xl border border-line bg-white p-3.5 shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-[#e2dfd9] hover:shadow-lift md:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[#57534c]">{kpi.label}</p>
        {icon ? (
          <span className="shrink-0 text-[#c0bcb4] transition-colors duration-150 group-hover:text-[#6f6a62]" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>

      <p className="mt-2 flex items-baseline gap-1">
        <span className="tnum origin-left text-[26px] font-semibold leading-none tracking-tight text-[#111827] transition-transform duration-150 ease-out group-hover:scale-[1.03] md:text-[28px]">
          {kpi.value}
        </span>
        {kpi.unit ? <span className="text-xs text-[#6f6a62]">{kpi.unit}</span> : null}
      </p>

      <p className="mt-1 truncate text-[11px] text-[#6f6a62]" title={kpi.hint}>
        {kpi.hint}
      </p>

      <div className="mt-2">
        <TrendPill dir={kpi.trend.dir} text={kpi.trend.text} />
      </div>
    </article>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-white p-3.5 shadow-card md:p-5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3.5 h-7 w-24" />
      <Skeleton className="mt-2 h-3 w-28" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

export function KpiGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 md:gap-4', className)}>{children}</div>;
}
