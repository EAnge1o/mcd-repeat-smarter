import type { HistoryOrder, Plan } from '../../server/domain/types';
import { Badge, Button, Card, CardHead, EmptyState, Alert, cx } from '../components/ui';
import { KpiCard, KpiCardSkeleton, KpiGrid } from '../components/KpiCard';
import { SpendTrend } from '../components/SpendTrend';
import { HourDonut, type Bucket } from '../components/HourDonut';
import { OrdersTable } from '../components/OrdersTable';
import { PlansGrid } from '../components/PlansGrid';
import { IconArrow, IconBookmark, IconReceipt, IconSparkle, IconWallet } from '../components/Icons';
import type { Kpi, SpendPoint } from '../lib/metrics';
import type { ViewKey } from '../components/Sidebar';

interface TopItem {
  productCode: string;
  name: string;
  count: number;
}

interface OverviewProps {
  dateLabel: string;
  mode: 'live' | 'demo';
  demoReason?: string;
  storeName: string;
  kpis: Kpi[];
  series: { points: SpendPoint[]; skipped: number };
  buckets: Bucket[];
  tops: TopItem[];
  orders: HistoryOrder[];
  ordersLoading: boolean;
  plans: Plan[];
  plansLoading: boolean;
  onNavigate: (v: ViewKey) => void;
  onUsePlan: (p: Plan) => void;
  onUseOrder: (o: HistoryOrder) => void;
  onDeletePlan: (p: Plan) => void;
  onDuplicatePlan: (p: Plan) => void;
  onRenamePlan: (p: Plan) => void;
  onUseLatest: () => void;
}

const KPI_ICON = [IconReceipt, IconWallet, IconSparkle, IconBookmark];

/** 常点单品横条。用横向条而不是饼图：单品之间是「次数」这种同量纲比较，条长最直观。 */
function TopItems({ items, total }: { items: TopItem[]; total: number }) {
  if (items.length === 0) {
    return <EmptyState compact title="还没有常点单品" desc="历史订单里没有可统计的餐品明细。" />;
  }

  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ul className="space-y-2 px-4 py-3.5 md:px-5">
      {items.map((it, i) => (
        <li key={it.productCode} className="group">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="tnum w-3 shrink-0 text-[10px] text-[#c0bcb4]">{i + 1}</span>
              <span className="truncate text-[12px] text-[#4b4945]" title={it.name}>
                {it.name}
              </span>
            </span>
            <span className="tnum shrink-0 text-[11px] text-[#8a877f]">
              {it.count} 次
              <span className="ml-1 text-[10px] text-[#c0bcb4]">{Math.round((it.count / Math.max(total, 1)) * 100)}%</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f2f0ec]">
            <div
              className={cx('h-full rounded-full transition-all duration-200 ease-out', i === 0 ? 'bg-brand-500' : 'bg-[#e2665a]')}
              style={{ width: `${Math.max((it.count / max) * 100, 6)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Overview(props: OverviewProps) {
  const {
    dateLabel,
    mode,
    demoReason,
    storeName,
    kpis,
    series,
    buckets,
    tops,
    orders,
    ordersLoading,
    plans,
    plansLoading,
    onNavigate,
    onUsePlan,
    onUseOrder,
    onDeletePlan,
    onDuplicatePlan,
    onRenamePlan,
    onUseLatest,
  } = props;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-[#8a877f]">
            {dateLabel}
            {storeName ? <span className="text-[#c0bcb4]"> · {storeName}</span> : null}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#111827] md:text-2xl">
            今天，还是<span className="text-brand-600">老样子</span>吗？
          </h1>
          <p className="mt-1 text-xs text-[#6b6862]">记得你的习惯，也听得懂你今天的小变化。</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => onNavigate('order')}>
            <IconSparkle size={14} />
            开始点单
          </Button>
          <Button onClick={() => onNavigate('plans')}>
            <IconBookmark size={14} />
            常用方案
          </Button>
        </div>
      </div>

      {mode === 'demo' ? (
        <Alert kind="warn" title="当前是演示数据" hint="页面上的门店、餐品、价格均为内置示例，用于体验完整流程，不代表真实供应情况。">
          {demoReason ?? '未连接真实 MCP'}
        </Alert>
      ) : null}

      {/* KPI */}
      <KpiGrid>
        {ordersLoading
          ? [0, 1, 2, 3].map((i) => <KpiCardSkeleton key={i} />)
          : kpis.map((k, i) => {
              const Icon = KPI_ICON[i] ?? IconSparkle;
              return <KpiCard key={k.key} kpi={k} icon={<Icon size={15} />} />;
            })}
      </KpiGrid>

      {/* 图表：主图 2/3，辅助图 1/3 */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-3">
        <Card className="flex flex-col xl:col-span-2">
          <CardHead
            title="消费趋势"
            desc={series.points.length > 0 ? `近 ${series.points.length} 笔订单的实付金额` : '按时间正序'}
            action={
              <Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? 'MCP 实付' : '演示数据'}</Badge>
            }
          />
          <div className="flex w-full flex-1 items-center">
            {ordersLoading ? <div className="skeleton m-4 h-[220px] w-full" /> : <SpendTrend points={series.points} skipped={series.skipped} />}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHead title="下单时段" desc="按历史订单的下单时间分桶" />
          <div className="flex w-full flex-1 items-center">
            {ordersLoading ? <div className="skeleton m-4 h-[180px] w-full" /> : <HourDonut buckets={buckets} />}
          </div>
        </Card>
      </div>

      {/* 常用方案 + 常点单品 */}
      <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead
            title="常用方案"
            desc="整单复用，也可以当作下一次修改的起点"
            action={
              <Button size="sm" onClick={() => onNavigate('plans')}>
                管理
                <IconArrow size={11} />
              </Button>
            }
          />
          <PlansGrid
            plans={plans.slice(0, 2)}
            loading={plansLoading}
            onUse={onUsePlan}
            onDelete={onDeletePlan}
            onDuplicate={onDuplicatePlan}
            onRename={onRenamePlan}
            emptyAction={
              <Button variant="primary" size="sm" onClick={() => onNavigate('order')}>
                去调一单
              </Button>
            }
          />
        </Card>

        <Card>
          <CardHead title="常点单品" desc="按出现次数排序" action={<span className="tnum text-[11px] text-[#a8a49c]">{orders.length} 单样本</span>} />
          <TopItems items={tops} total={orders.length} />
        </Card>
      </div>

      {/* 最近订单 */}
      <Card>
        <CardHead
          title="最近订单"
          desc={mode === 'live' ? '读取自你的麦当劳账号' : '内置示例，非真实账号'}
          action={
            <Button size="sm" onClick={() => onNavigate('orders')}>
              查看全部
              <IconArrow size={11} />
            </Button>
          }
        />
        <OrdersTable
          orders={orders}
          loading={ordersLoading}
          limit={5}
          onUse={onUseOrder}
          emptyAction={
            <Button variant="primary" size="sm" onClick={onUseLatest}>
              还是老样子
            </Button>
          }
        />
      </Card>
    </div>
  );
}
