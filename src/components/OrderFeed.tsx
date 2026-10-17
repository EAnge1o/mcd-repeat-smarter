import type { HistoryOrder } from '../../server/domain/types';
import { EmptyState, Skeleton, cx } from './ui';
import { IconArrow, IconChevronDown, IconRefresh } from './Icons';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';

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

/** 金额三态：没返回 / 券全额抵扣 / 正常金额。混成一种是最容易让人误判的地方。 */
function Amount({ order, className }: { order: HistoryOrder; className?: string }) {
  const c = paidCents(order);
  if (c === null) {
    return (
      <span className={cx('tnum text-[#6f6a62]', className)} title="接口未返回实付金额">
        —
      </span>
    );
  }
  return (
    <span className={cx('tnum', c === 0 ? 'text-[#57534c]' : 'text-[#111827]', className)}>
      ¥{yuan(c)}
      {c === 0 ? <span className="ml-1 text-[10px] font-normal text-[#6f6a62]">券</span> : null}
    </span>
  );
}

/**
 * 订单流 —— 概览页不用表格。
 *
 * 表格适合「逐列比对」，但这里用户要做的是「认出某一单，然后复用它」，
 * 所以改成一行一单的清单：时间最轻、餐品最重、金额右对齐。
 * 点开就地展开明细，不跳页；「再来一单」在展开区里才出现，避免每行都挂一个按钮。
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
    <section aria-labelledby="feed-title" className="border-t border-line pt-6 md:pt-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
          <h2 id="feed-title" className="text-[15px] font-semibold tracking-tight text-[#111827]">
            最近订单
          </h2>
          {filterLabel ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">
              {filterLabel}
              <span className="tnum text-brand-600/80">{matchCount} 单</span>
              <button
                type="button"
                onClick={onClearFilter}
                className="-mr-0.5 rounded px-0.5 text-[11px] font-medium text-brand-700 transition-colors duration-150 hover:text-brand-800"
                aria-label="清除时段筛选"
              >
                清除
              </button>
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="group inline-flex items-center gap-1 rounded-md py-0.5 text-[11.5px] font-medium text-[#57534c] transition-colors duration-150 hover:text-brand-600"
        >
          全部 {total} 单
          <IconArrow size={11} className="transition-transform duration-150 group-hover:translate-x-0.5" />
        </button>
      </div>

      {loading ? (
        <ul className="mt-2 divide-y divide-line/70">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-4 py-3.5">
              <Skeleton className="h-6 w-12" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-1.5 h-3 w-1/3" />
              </div>
              <Skeleton className="h-3.5 w-14" />
            </li>
          ))}
        </ul>
      ) : orders.length === 0 ? (
        <EmptyState
          compact
          title={filterLabel ? '这个时段没有订单' : '还没有历史订单'}
          desc={filterLabel ? '换一个时段，或者清除筛选看全部。' : '完成一单后，这里会显示时间、门店、餐品与实付金额。'}
          action={filterLabel ? undefined : emptyAction}
        />
      ) : (
        <ul className="mt-1.5">
          {orders.map((o) => {
            const open = openId === o.orderId;
            const pieces = o.items.reduce((n, i) => n + i.quantity, 0);
            const brief = o.items.map((i) => `${i.quantity}×${i.name}`).join('、');

            return (
              <li key={o.orderId} className="border-b border-line/70 last:border-0">
                <button
                  type="button"
                  onClick={() => onToggle(o.orderId)}
                  aria-expanded={open}
                  aria-controls={`detail-${o.orderId}`}
                  className="group grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md px-1.5 py-3 text-left transition-colors duration-150 ease-out hover:bg-[#faf9f7] md:grid-cols-[4.5rem_minmax(0,1fr)_auto] md:gap-x-5 md:py-3.5"
                >
                  <span className="tnum text-[10.5px] leading-tight text-[#6f6a62]">
                    <span className="block text-[11.5px] text-[#57534c]">{fmtDateTime(o.createTime).split(' ')[0]}</span>
                    <span className="block">{fmtDateTime(o.createTime).split(' ')[1]}</span>
                  </span>

                  <span className="min-w-0">
                    <span className={cx('block truncate text-[13px]', open ? 'text-[#111827]' : 'text-[#111827]')} title={brief}>
                      {brief || '（无明细）'}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[#6f6a62]">
                      {o.storeName || o.storeCode}
                      <span className="px-1.5">·</span>
                      <span className="tnum">共 {pieces} 件</span>
                      <span className="hidden sm:inline">
                        <span className="px-1.5">·</span>
                        {o.orderStatus || '状态未知'}
                      </span>
                    </span>
                  </span>

                  <span className="flex items-center gap-2 md:gap-3">
                    <Amount order={o} className="text-[13px] font-medium" />
                    <span
                      className={cx('text-[#6f6a62] transition-transform duration-150 ease-out group-hover:text-[#4b4945]', open ? 'rotate-180' : '')}
                      aria-hidden="true"
                    >
                      <IconChevronDown size={14} />
                    </span>
                  </span>
                </button>

                {open ? (
                  <div
                    id={`detail-${o.orderId}`}
                    className="animate-fade-up rounded-md bg-[#faf9f7] px-3.5 py-3.5 md:px-4"
                  >
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:gap-8">
                      <ul className="min-w-0 space-y-1.5">
                        {o.items.map((it, i) => (
                          <li key={`${it.productCode}-${i}`}>
                            <p className="flex items-baseline gap-2 text-[12.5px] text-[#111827]">
                              <span className="tnum w-6 shrink-0 text-right text-[11px] text-[#6f6a62]">{it.quantity}×</span>
                              <span className="min-w-0 flex-1">{it.name}</span>
                            </p>
                            {it.children.length > 0 ? (
                              <p className="mt-0.5 pl-8 text-[10.5px] leading-relaxed text-[#6f6a62]">
                                {it.children.map((c) => `${c.roundName ? `${c.roundName} · ` : ''}${c.name}`).join(' / ')}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      <div className="shrink-0 md:text-right">
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] md:grid-cols-1 md:space-y-1">
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-[#6f6a62]">订单号</dt>
                            <dd className="tnum text-[#3d3a35]">#{o.orderId.slice(-8)}</dd>
                          </div>
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-[#6f6a62]">实付</dt>
                            <dd>
                              <Amount order={o} className="text-[11px]" />
                            </dd>
                          </div>
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-[#6f6a62]">状态</dt>
                            <dd className="text-[#3d3a35]">{o.orderStatus || '未知'}</dd>
                          </div>
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-[#6f6a62]">门店</dt>
                            <dd className="truncate text-[#3d3a35] md:max-w-[220px]" title={o.storeName}>
                              {o.storeName || o.storeCode}
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          onClick={() => onUse(o)}
                          className="mt-2.5 inline-flex h-7 items-center gap-1.5 rounded-md bg-white px-2.5 text-[11.5px] font-medium text-[#3d3a35] ring-1 ring-inset ring-line transition-colors duration-150 ease-out hover:bg-brand-500 hover:text-white hover:ring-brand-500 active:scale-[0.97]"
                        >
                          <IconRefresh size={12} />
                          再来一单
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
