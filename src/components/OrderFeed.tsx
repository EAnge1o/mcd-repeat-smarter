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
      <span className={cx('tnum text-ink-faint', className)} title="接口未返回实付金额">
        —
      </span>
    );
  }
  return (
    <span className={cx('tnum display', c === 0 ? 'text-ink-mute' : 'text-ink', className)}>
      ¥{yuan(c)}
      {c === 0 ? <span className="ml-1 font-sans text-[9px] font-normal tracking-[0.1em] text-ink-faint">券</span> : null}
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
    <section aria-labelledby="feed-title">
      <div className="flex flex-wrap items-end justify-between gap-x-5 gap-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h2 id="feed-title" className="display text-[24px] leading-none text-ink md:text-[29px]">
            最近订单
          </h2>
          {filterLabel ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-[10.5px] text-brand-700">
              {filterLabel}
              <span className="tnum font-mono text-[9.5px] text-brand-600/80">{matchCount} 单</span>
              <button
                type="button"
                onClick={onClearFilter}
                className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-brand-700 transition-colors duration-200 hover:bg-white"
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
          className="group inline-flex items-center gap-1.5 pb-1 text-[11px] font-medium text-ink-mute transition-colors duration-200 hover:text-brand-600"
        >
          全部 {total} 单
          <IconArrow size={10} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>
      </div>

      {loading ? (
        <ul className="mt-4 divide-y divide-hair">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-4 py-4">
              <Skeleton className="h-6 w-12" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="mt-2 h-3 w-1/3" />
              </div>
              <Skeleton className="h-4 w-14" />
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
        <ul className="mt-3">
          {orders.map((o) => {
            const open = openId === o.orderId;
            const pieces = o.items.reduce((n, i) => n + i.quantity, 0);
            const brief = o.items.map((i) => `${i.quantity}×${i.name}`).join('、');

            return (
              <li key={o.orderId} className="border-b border-hair last:border-0">
                <button
                  type="button"
                  onClick={() => onToggle(o.orderId)}
                  aria-expanded={open}
                  aria-controls={`detail-${o.orderId}`}
                  className={cx(
                    'group grid w-full grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-2 py-3.5 text-left',
                    'transition-colors duration-200 ease-out md:grid-cols-[4.25rem_minmax(0,1fr)_auto] md:gap-x-5',
                    open ? 'bg-[#fbf7f3]' : 'hover:bg-[#fbf7f3]',
                  )}
                >
                  <span className="tnum font-mono text-[9.5px] leading-[1.6] tracking-[0.02em] text-ink-faint">
                    <span className="block text-ink-mute">{fmtDateTime(o.createTime).split(' ')[0]}</span>
                    <span className="block">{fmtDateTime(o.createTime).split(' ')[1]}</span>
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink" title={brief}>
                      {brief || '（无明细）'}
                    </span>
                    <span className="mt-1 block truncate text-[10.5px] text-ink-faint">
                      {o.storeName || o.storeCode}
                      <span className="px-1.5 text-[#d5cec6]">·</span>
                      <span className="tnum">共 {pieces} 件</span>
                      <span className="hidden sm:inline">
                        <span className="px-1.5 text-[#d5cec6]">·</span>
                        {o.orderStatus || '状态未知'}
                      </span>
                    </span>
                  </span>

                  <span className="flex items-center gap-2 md:gap-3">
                    <Amount order={o} className="text-[15px]" />
                    <span
                      className={cx('text-ink-faint transition-transform duration-200 ease-out group-hover:text-ink-mute', open ? 'rotate-180' : '')}
                      aria-hidden="true"
                    >
                      <IconChevronDown size={14} />
                    </span>
                  </span>
                </button>

                {open ? (
                  <div
                    id={`detail-${o.orderId}`}
                    className="animate-fade-up mb-1 mt-1 rounded-2xl bg-[#fbf7f3] px-4 py-4 md:px-5"
                  >
                    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:gap-10">
                      <ul className="min-w-0 space-y-2">
                        {o.items.map((it, i) => (
                          <li key={`${it.productCode}-${i}`}>
                            <p className="flex items-baseline gap-2.5 text-[12.5px] text-ink">
                              <span className="tnum w-6 shrink-0 text-right font-mono text-[10px] text-ink-faint">{it.quantity}×</span>
                              <span className="min-w-0 flex-1">{it.name}</span>
                            </p>
                            {it.children.length > 0 ? (
                              <p className="mt-1 pl-[34px] text-[10.5px] leading-relaxed text-ink-faint">
                                {it.children.map((c) => `${c.roundName ? `${c.roundName} · ` : ''}${c.name}`).join(' / ')}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>

                      <div className="shrink-0 md:text-right">
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[10.5px] md:grid-cols-1 md:space-y-1.5">
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-ink-faint">订单号</dt>
                            <dd className="tnum font-mono text-ink-soft">#{o.orderId.slice(-8)}</dd>
                          </div>
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-ink-faint">实付</dt>
                            <dd>
                              <Amount order={o} className="text-[11px]" />
                            </dd>
                          </div>
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-ink-faint">状态</dt>
                            <dd className="text-ink-soft">{o.orderStatus || '未知'}</dd>
                          </div>
                          <div className="flex gap-1.5 md:justify-end">
                            <dt className="text-ink-faint">门店</dt>
                            <dd className="truncate text-ink-soft md:max-w-[200px]" title={o.storeName}>
                              {o.storeName || o.storeCode}
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          onClick={() => onUse(o)}
                          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11px] font-medium text-ink-soft ring-1 ring-inset ring-line transition-[background-color,color] duration-200 ease-out hover:bg-ink hover:text-white active:scale-[0.97]"
                        >
                          <IconRefresh size={11} />
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
