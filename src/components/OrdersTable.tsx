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
      <div className="space-y-2 p-4 md:p-5">
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
                  'whitespace-nowrap px-4 py-2 text-[11px] font-medium text-[#6f6a62] md:px-5',
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
              <tr key={o.orderId} className="group border-b border-line/70 transition-colors duration-150 last:border-0 hover:bg-[#faf9f7]">
                <td className="whitespace-nowrap px-4 py-2.5 text-[12px] text-[#4b4945] md:px-5">
                  <span className="tnum">{fmtDateTime(o.createTime)}</span>
                </td>

                <td className="max-w-[190px] px-4 py-2.5 text-[12px] md:px-5">
                  <span className="block truncate text-[#111827]" title={o.storeName}>
                    {o.storeName || o.storeCode}
                  </span>
                  <span className="tnum block text-[10px] text-[#6f6a62]">#{o.orderId.slice(-8)}</span>
                </td>

                <td className="max-w-[280px] px-4 py-2.5 text-[12px] md:px-5">
                  <span className="block truncate text-[#4b4945]" title={o.items.map((i) => `${i.quantity}×${i.name}`).join('、')}>
                    {o.items.length === 0 ? '（无明细）' : o.items.map((i) => `${i.quantity}×${i.name}`).join('、')}
                  </span>
                  <span className="text-[10px] text-[#6f6a62]">共 {o.items.reduce((n, i) => n + i.quantity, 0)} 件</span>
                </td>

                <td className={cx('tnum whitespace-nowrap px-4 py-2.5 text-right text-[12px] md:px-5', zero ? 'text-[#6f6a62]' : 'text-[#111827]')}>
                  {c === null ? (
                    <span className="text-[#6f6a62]" title="接口未返回实付金额">
                      —
                    </span>
                  ) : (
                    <>
                      ¥{yuan(c)}
                      {zero ? <span className="ml-1 text-[10px] text-[#6f6a62]">券抵扣</span> : null}
                    </>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-2.5 md:px-5">
                  <Badge tone="neutral">{o.orderStatus || '未知'}</Badge>
                </td>

                <td className="whitespace-nowrap px-4 py-2.5 text-right md:px-5">
                  {onUse ? (
                    <button
                      type="button"
                      onClick={() => onUse(o)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[#57534c] opacity-0 transition-all duration-150 hover:bg-[#f2f0ec] hover:text-brand-600 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      再来一单
                      <IconArrow size={11} />
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
