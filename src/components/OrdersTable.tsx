import type { HistoryOrder } from '../../server/domain/types';
import { Badge, EmptyState, Skeleton, cx } from './ui';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';
import { IconArrow } from './Icons';

interface OrdersTableProps {
  orders: HistoryOrder[];
  loading?: boolean;
  onUse?: (order: HistoryOrder) => void;
  /** 概览页只显示前几行，完整列表在「订单记录」页 */
  limit?: number;
  emptyAction?: React.ReactNode;
}

/**
 * 订单表格。
 *
 * 金额三态必须区分开：接口没返回（—）／券全额抵扣（¥0.00 降权显示）／正常金额。
 * 把「没返回」画成 ¥0.00 是最容易让人误判的地方。
 */
export function OrdersTable({ orders, loading, onUse, limit, emptyAction }: OrdersTableProps) {
  const rows = limit ? orders.slice(0, limit) : orders;

  if (loading) {
    return (
      <div className="space-y-3 py-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyState title="还没有历史订单" desc="完成一单后，这里会显示订单号、门店、餐品与实付金额。" action={emptyAction} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            {['下单时间', '门店', '餐品', '实付', '状态', ''].map((h, i) => (
              <th
                key={h || i}
                scope="col"
                className={cx(
                  'whitespace-nowrap px-3 py-2.5 font-mono text-[9.5px] font-normal uppercase tracking-[0.14em] text-ink-faint md:px-4',
                  i === 3 ? 'text-right' : '',
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => {
            const c = paidCents(o);
            const zero = c === 0;
            return (
              <tr key={o.orderId} className="group border-b border-hair transition-colors duration-200 last:border-0 hover:bg-[#fbf7f3]">
                <td className="whitespace-nowrap px-3 py-3 md:px-4">
                  <span className="tnum block font-mono text-[10px] tracking-[0.02em] text-ink-mute">{fmtDateTime(o.createTime)}</span>
                </td>

                <td className="max-w-[190px] px-3 py-3 md:px-4">
                  <span className="block truncate text-[12px] text-ink" title={o.storeName}>
                    {o.storeName || o.storeCode}
                  </span>
                  <span className="tnum block font-mono text-[9.5px] text-ink-faint">#{o.orderId.slice(-8)}</span>
                </td>

                <td className="max-w-[280px] px-3 py-3 md:px-4">
                  <span className="block truncate text-[12px] text-ink-soft" title={o.items.map((i) => `${i.quantity}×${i.name}`).join('、')}>
                    {o.items.length === 0 ? '（无明细）' : o.items.map((i) => `${i.quantity}×${i.name}`).join('、')}
                  </span>
                  <span className="text-[10px] text-ink-faint">共 {o.items.reduce((n, i) => n + i.quantity, 0)} 件</span>
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right md:px-4">
                  <span className={cx('tnum display text-[13px]', zero ? 'text-ink-mute' : 'text-ink')}>
                    {c === null ? (
                      <span className="text-ink-faint" title="接口未返回实付金额">
                        —
                      </span>
                    ) : (
                      <>
                        ¥{yuan(c)}
                        {zero ? <span className="ml-1 font-sans text-[9px] tracking-[0.08em] text-ink-faint">券抵扣</span> : null}
                      </>
                    )}
                  </span>
                </td>

                <td className="whitespace-nowrap px-3 py-3 md:px-4">
                  <Badge tone="neutral">{o.orderStatus || '未知'}</Badge>
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right md:px-4">
                  {onUse ? (
                    <button
                      type="button"
                      onClick={() => onUse(o)}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-medium text-ink-mute opacity-0 transition-all duration-200 hover:bg-white hover:text-brand-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      再来一单
                      <IconArrow size={10} />
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
