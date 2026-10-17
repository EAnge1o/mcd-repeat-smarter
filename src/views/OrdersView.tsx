import type { HistoryOrder } from '../../server/domain/types';
import { Badge, Button, Panel, Stat } from '../components/ui';
import { OrdersTable } from '../components/OrdersTable';
import { IconRefresh, IconSparkle } from '../components/Icons';
import { paidCents, yuan } from '../lib/metrics';

export function OrdersView({
  orders,
  loading,
  mode,
  onUse,
  onUseLatest,
  onRefresh,
}: {
  orders: HistoryOrder[];
  loading: boolean;
  mode: 'live' | 'demo';
  onUse: (o: HistoryOrder) => void;
  onUseLatest: () => void;
  onRefresh: () => void;
}) {
  const priced = orders.map(paidCents).filter((c): c is number => c !== null && c > 0);
  const total = priced.reduce((a, b) => a + b, 0);
  const zeroCount = orders.filter((o) => paidCents(o) === 0).length;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="max-w-[560px]">
          <p className="eyebrow">订单记录 · 全部来自真实接口</p>
          <h1 className="display mt-3 text-[27px] leading-[1.15] text-ink md:text-[34px]">每一单都记得</h1>
          <p className="mt-2.5 max-w-[34rem] text-pretty text-[12.5px] leading-[1.9] text-ink-mute">
            {mode === 'live'
              ? '读取自你的麦当劳账号，按下单时间倒序。金额取接口返回的实付值，未返回的显示为「—」而不是 0。'
              : '当前为内置演示数据，不是真实账号。切到真实 MCP 后会读取你自己的历史订单。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRefresh}>
            <IconRefresh size={12} />
            重新读取
          </Button>
          <Button variant="primary" arrow onClick={onUseLatest} disabled={orders.length === 0}>
            <IconSparkle size={13} />
            还是老样子
          </Button>
        </div>
      </header>

      <section aria-label="订单概况" className="mt-9 border-y border-hair">
        <dl className="grid grid-cols-2 md:grid-cols-4">
          <div className="py-6 md:pl-0 md:pr-7">
            <Stat label="订单总数" value={String(orders.length)} unit="单" />
          </div>
          <div className="border-l border-hair px-4 py-6 md:px-7">
            <Stat label="合计消费" value={priced.length > 0 ? `¥${yuan(total)}` : '—'} tone="brand" />
          </div>
          <div className="border-t border-hair py-6 md:border-l md:border-t-0 md:pl-7 md:pr-0">
            <Stat label="有金额的订单" value={String(priced.length)} unit="笔" />
          </div>
          <div className="border-l border-t border-hair px-4 py-6 md:border-t-0 md:pl-7 md:pr-0">
            <Stat label="券抵扣订单" value={String(zeroCount)} unit="笔" hint={zeroCount > 0 ? '实付 ¥0' : '没有全额抵扣的单'} />
          </div>
        </dl>
      </section>

      <Panel className="mt-6 px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">全部订单</p>
            <h2 className="display mt-2 text-[20px] text-ink md:text-[23px]">按下单时间倒序</h2>
          </div>
          <Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? 'MCP 实时' : '演示数据'}</Badge>
        </div>
        <div className="mt-4">
          <OrdersTable orders={orders} loading={loading} onUse={onUse} />
        </div>
      </Panel>
    </div>
  );
}
