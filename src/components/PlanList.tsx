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
      <ul className="space-y-2.5">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-4 rounded-2xl bg-ink/4 p-4">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2.5 h-3 w-48" />
            </div>
            <Skeleton className="h-9 w-20 rounded-full" />
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
      <ul className="space-y-2.5">
        {shown.map((p, i) => {
          const pieces = p.items.reduce((n, it) => n + it.quantity, 0);
          const detail = p.items.map((it) => `${it.quantity}×${it.name}`).join('、');
          return (
            <li
              key={p.id}
              className="group flex items-center gap-4 rounded-2xl bg-ink/[0.04] px-4 py-3.5 ring-2 ring-transparent transition-colors duration-100 hover:bg-gold-100 hover:ring-ink/10"
            >
              {/* 序号做成黄色圆形 —— 麦当劳菜单编号是黄底黑字 */}
              <span
                className="tnum grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold-400 text-[13px] font-black leading-none text-ink"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[14.5px] font-black text-ink" title={p.name}>
                    {p.name}
                  </span>
                  {p.tag ? (
                    <span className="shrink-0 rounded-full bg-ink/8 px-2 py-0.5 text-[11.5px] font-bold text-ink-mute">{p.tag}</span>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-[13px] text-ink-mute" title={`${detail} · ${p.storeName || p.storeCode}`}>
                  <span className="tnum font-bold text-ink-faint">{pieces} 件</span>
                  <span className="px-1.5 text-ink-faint">·</span>
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
                  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] font-black',
                  'bg-brand-500 text-white shadow-brand-press transition-colors duration-100',
                  'hover:bg-brand-600 active:translate-y-[3px] active:shadow-none',
                )}
              >
                用它
                <IconArrow size={11} />
              </button>
            </li>
          );
        })}
      </ul>

      {rest > 0 ? (
        <button
          type="button"
          onClick={onManage}
          className="group mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-black text-white shadow-[0_3px_0_rgba(13,13,13,0.28)] transition-colors duration-100 hover:bg-ink-soft active:translate-y-[3px] active:shadow-none"
        >
          还有 {rest} 个方案
          <IconArrow size={11} className="transition-transform duration-100 group-hover:translate-x-0.5" />
        </button>
      ) : null}
    </>
  );
}
