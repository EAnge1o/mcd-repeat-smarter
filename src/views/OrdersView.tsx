import type { HistoryOrder } from '../../server/domain/types';
import { Badge, Button, Card, CardHead } from '../components/ui';
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
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111827] md:text-2xl">订单记录</h1>
          <p className="mt-1 text-xs text-[#6b6862]">
            {mode === 'live' ? '读取自你的麦当劳账号，只在你本机与服务端之间流转。' : '当前为内置演示数据，非真实账号。'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onRefresh}>
            <IconRefresh size={13} />
            重新读取
          </Button>
          <Button variant="primary" onClick={onUseLatest} disabled={orders.length === 0}>
            <IconSparkle size={14} />
            还是老样子
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        {[
          { label: '订单总数', value: String(orders.length), unit: '单' },
          { label: '合计消费', value: priced.length > 0 ? `¥${yuan(total)}` : '—', unit: '' },
          { label: '有金额的订单', value: String(priced.length), unit: '笔' },
          { label: '券抵扣订单', value: String(zeroCount), unit: '笔' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
            <p className="text-[11px] text-[#8a877f]">{s.label}</p>
            <p className="mt-1 flex items-baseline gap-1">
              <span className="tnum text-[18px] font-semibold leading-none text-[#111827]">{s.value}</span>
              {s.unit ? <span className="text-[11px] text-[#8a877f]">{s.unit}</span> : null}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <CardHead
          title="全部订单"
          desc="按下单时间倒序，金额取接口返回的实付值"
          action={<Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? 'MCP 实时' : '演示数据'}</Badge>}
        />
        <OrdersTable orders={orders} loading={loading} onUse={onUse} />
      </Card>
    </div>
  );
}
