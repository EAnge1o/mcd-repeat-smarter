import type { Plan } from '../../server/domain/types';
import { EmptyState, Skeleton, cx } from './ui';
import { IconArrow } from './Icons';

interface PlanListProps {
  plans: Plan[];
  loading: boolean;
  /** 概览页只呈现前几条，完整管理在「常用方案」页 */
  limit?: number;
  onUse: (p: Plan) => void;
  onManage: () => void;
  emptyAction: React.ReactNode;
}

/**
 * 常用方案的紧凑清单。
 *
 * 概览页不放方案卡片网格：方案在这里是「快捷入口」，不是需要浏览的资产。
 * 一行一条、左侧内容右侧动作，比三张等宽卡省一半高度。
 */
export function PlanList({ plans, loading, limit = 3, onUse, onManage, emptyAction }: PlanListProps) {
  if (loading) {
    return (
      <ul className="divide-y divide-hair">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-4 py-4">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-2 h-3 w-48" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    );
  }

  if (plans.length === 0) {
    return (
      <EmptyState
        compact
        title="还没有保存的常用方案"
        desc="调好一单后点「存成常用方案」，下次说一句「还是老样子」就能整单调出来。"
        action={emptyAction}
      />
    );
  }

  const shown = plans.slice(0, limit);
  const rest = plans.length - shown.length;

  return (
    <>
      <ul className="divide-y divide-hair">
        {shown.map((p, i) => {
          const pieces = p.items.reduce((n, it) => n + it.quantity, 0);
          const detail = p.items.map((it) => `${it.quantity}×${it.name}`).join('、');
          return (
            <li key={p.id} className="group flex items-center gap-3.5 py-3.5">
              <span className="tnum grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#f6f1ec] text-[9px] leading-none text-ink-faint" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[13px] text-ink" title={p.name}>
                    {p.name}
                  </span>
                  {p.tag ? <span className="shrink-0 text-[9px] tracking-[0.08em] text-ink-faint">{p.tag}</span> : null}
                </div>
                <p className="mt-1 truncate text-[11px] text-ink-faint" title={`${detail} · ${p.storeName || p.storeCode}`}>
                  <span className="tnum">{pieces} 件</span>
                  <span className="px-1.5 text-[#d5cec6]">·</span>
                  {detail}
                </p>
              </div>
              {/* 动作常驻，不藏在 hover 里 —— 这一列是整页唯一能复用的入口，
                  而触屏设备根本没有 hover；右侧留白也随之收掉 */}
              <button
                type="button"
                onClick={() => onUse(p)}
                aria-label={`用「${p.name}」下一单`}
                className={cx(
                  'inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-medium',
                  'bg-white text-ink-soft ring-1 ring-inset ring-line transition-[background-color,color,box-shadow] duration-200 ease-out',
                  'hover:bg-ink hover:text-white hover:ring-ink active:scale-[0.97]',
                )}
              >
                用它
                <IconArrow size={10} />
              </button>
            </li>
          );
        })}
      </ul>

      {rest > 0 ? (
        <button
          type="button"
          onClick={onManage}
          className="group mt-3 inline-flex items-center gap-1.5 text-[11px] text-ink-mute transition-colors duration-200 hover:text-brand-600"
        >
          还有 {rest} 个方案
          <IconArrow size={10} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      ) : null}
    </>
  );
}
