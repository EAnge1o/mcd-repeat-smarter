import type { HistoryOrder } from '../../server/domain/types';
import { EmptyState } from './ui';
import { OrdersTable } from './OrdersTable';
import { IconArrow } from './Icons';

interface OrderFeedProps {
  orders: HistoryOrder[];
  /** 全部历史订单数，用于「全部 N 单」 */
  total: number;
  /** 当前筛选命中多少单。必须和 orders.length 分开：筛选后可能还有没渲染出来的行 */
  matchCount: number;
  loading: boolean;
  openId: string | null;
  filterLabel?: string | null;
  onToggle: (id: string) => void;
  onUse: (o: HistoryOrder) => void;
  onViewAll: () => void;
  onClearFilter: () => void;
  emptyAction?: React.ReactNode;
}

/**
 * 概览页的订单区。
 *
 * 只负责「标题 + 时段筛选条 + 全部 N 单入口」，列表本体交给 OrdersTable ——
 * 两个页面共用同一个列表，才不会变成两套 UI。展开态由外面控制，
 * 因为概览页点趋势图要能定位并展开指定的那一单。
 */
export function OrderFeed({
  orders,
  total,
  matchCount,
  loading,
  openId,
  filterLabel,
  onToggle,
  onUse,
  onViewAll,
  onClearFilter,
  emptyAction,
}: OrderFeedProps) {
  return (
    <section aria-labelledby="feed-title">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h2 id="feed-title" className="display display-24 text-ink md:display-36">
            最近订单
          </h2>
          {filterLabel ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-gold-400 py-1.5 pl-3.5 pr-1.5 text-[13px] font-black text-ink">
              {filterLabel}
              <span className="tnum">{matchCount} 单</span>
              <button
                type="button"
                onClick={onClearFilter}
                className="grid h-5 w-5 place-items-center rounded-full bg-ink/15 text-[11.5px] font-black transition-colors duration-100 hover:bg-ink hover:text-white"
                aria-label="清除时段筛选"
              >
                ×
              </button>
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="group inline-flex h-9 items-center gap-1.5 rounded-full bg-ink/6 px-4 text-[13px] font-black text-ink transition-colors duration-100 hover:bg-gold-400"
        >
          全部 {total} 单
          <IconArrow size={11} className="transition-transform duration-100 group-hover:translate-x-0.5" />
        </button>
      </div>

      {orders.length === 0 && !loading ? (
        <EmptyState
          compact
          title={filterLabel ? '这个时段没有订单' : '还没有历史订单'}
          desc={filterLabel ? '换一个时段，或者清除筛选看全部。' : '完成一单后，这里会显示时间、门店、餐品与实付金额。'}
          action={filterLabel ? undefined : emptyAction}
        />
      ) : (
        <div className="mt-4">
          <OrdersTable
            orders={orders}
            loading={loading}
            onUse={onUse}
            emptyAction={emptyAction}
            openId={openId}
            onToggle={onToggle}
          />
        </div>
      )}
    </section>
  );
}
