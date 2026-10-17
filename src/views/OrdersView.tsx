import type { HistoryOrder } from '../../server/domain/types';
import { Button, MetricLead, MetricPair } from '../components/ui';
import { OrdersTable } from '../components/OrdersTable';
import { IconRefresh, IconSparkle } from '../components/Icons';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';

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
  const avg = priced.length > 0 ? total / priced.length : null;
  const zeroCount = orders.filter((o) => paidCents(o) === 0).length;
  const latest = orders[0];

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          <h1 className="display text-[34px] leading-[1.05] text-ink md:text-[46px]">订单记录</h1>
          <p className="mt-3 max-w-[36rem] text-pretty text-[14.5px] font-medium leading-[1.8] text-ink-mute">
            {mode === 'live'
              ? '来自你的麦当劳账号，按下单时间倒序。金额取接口返回的实付值，接口没返回的显示为「—」，不按 0 算。'
              : '当前为内置演示数据，不是真实账号。切到真实 MCP 后会读取你自己的历史订单。'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onRefresh} disabled={loading}>
            <IconRefresh size={12} />
            重新读取
          </Button>
          <Button variant="primary" onClick={onUseLatest} disabled={orders.length === 0}>
            <IconSparkle size={13} />
            还是老样子
          </Button>
        </div>
      </header>

      {/*
        概况：一个主角 + 三个配角。
        原来这里是四个等宽、带竖分隔线的格子 —— 四个同样大小的数字等于告诉用户
        「这四个一样重要」，于是哪个都不重要。现在累计实付放大成唯一主角，
        其余退成一行次级数字，靠字重而非格子来分层。
      */}
      <section aria-label="消费概况" className="mt-9 md:mt-11">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-7">
          <MetricLead
            label="累计实付"
            value={priced.length > 0 ? `¥${yuan(total)}` : '—'}
            note={
              priced.length > 0
                ? `${priced.length} 笔有金额 · ${orders.length - priced.length} 笔接口未返回`
                : '接口还没有返回过实付金额'
            }
            loading={loading}
          />

          <MetricPair
            loading={loading}
            items={[
              { label: '订单总数', value: `${orders.length} 单` },
              { label: '平均客单价', value: avg !== null ? `¥${yuan(avg)}` : '—' },
              { label: '券全额抵扣', value: zeroCount > 0 ? `${zeroCount} 笔` : '无' },
              ...(latest ? [{ label: '最近一单', value: fmtDateTime(latest.createTime) }] : []),
            ]}
          />
        </div>

        <div className="hair mt-7" aria-hidden="true" />
      </section>

      <section className="mt-7">
        <OrdersTable orders={orders} loading={loading} onUse={onUse} controls />
      </section>
    </div>
  );
}
