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
 * 概览页不放方案卡片网格：方案在这个页面上的角色是「快捷入口」，不是需要浏览的资产。
 * 一行一条、左侧内容右侧动作，比三张等宽卡省一半高度，也把卡片留给真正需要强调的东西。
 * 完整的信息（明细、分类、编辑/复制/删除）在「常用方案」页。
 */
export function PlanList({ plans, loading, limit = 3, onUse, onManage, emptyAction }: PlanListProps) {
  if (loading) {
    return (
      <ul className="mt-1 divide-y divide-line/70">
        {[0, 1, 2].map((i) => (
          <li key={i} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="mt-1.5 h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-14" />
          </li>
        ))}
      </ul>
    );
  }

  if (plans.length === 0) {
    return <EmptyState compact title="还没有保存的常用方案" desc="调好一单后点「存成常用方案」，下次说一句「还是老样子」就能整单调出来。" action={emptyAction} />;
  }

  const shown = plans.slice(0, limit);
  const rest = plans.length - shown.length;

  return (
    <>
      <ul className="mt-1 divide-y divide-line/70">
        {shown.map((p) => {
          const pieces = p.items.reduce((n, i) => n + i.quantity, 0);
          const detail = p.items.map((i) => `${i.quantity}×${i.name}`).join('、');
          return (
            <li key={p.id} className="group flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium text-[#111827]" title={p.name}>
                    {p.name}
                  </span>
                  {p.tag ? <span className="shrink-0 text-[10.5px] text-[#6f6a62]">{p.tag}</span> : null}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-[#6f6a62]" title={`${detail} · ${p.storeName || p.storeCode}`}>
                  <span className="tnum">{pieces} 件</span>
                  <span className="px-1.5">·</span>
                  {detail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUse(p)}
                aria-label={`用「${p.name}」下一单`}
                className={cx(
                  'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium transition-colors duration-150 ease-out active:scale-[0.97]',
                  'bg-[#f2f0ec] text-[#3d3a35] hover:bg-brand-500 hover:text-white',
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
          className="mt-1 inline-flex items-center gap-1 rounded-md py-1 text-[11.5px] text-[#57534c] transition-colors duration-150 hover:text-brand-600"
        >
          还有 {rest} 个方案
          <IconArrow size={11} />
        </button>
      ) : null}
    </>
  );
}
