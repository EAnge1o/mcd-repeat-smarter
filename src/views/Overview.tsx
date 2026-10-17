import { useCallback, useMemo, useRef, useState } from 'react';
import type { HistoryOrder, Plan } from '../../server/domain/types';
import { Button, MetricLead, MetricPair, Panel, SectionHead } from '../components/ui';
import { Hero } from '../components/Hero';
import { MemoryRail } from '../components/MemoryRail';
import { PlanList } from '../components/PlanList';
import { SpendTrend } from '../components/SpendTrend';
import { OrderFeed } from '../components/OrderFeed';
import { IconSparkle } from '../components/Icons';
import { bucketOf, paidCents, type Bucket, type Choice, type Kpi, type SpendPoint, yuan } from '../lib/metrics';
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
  lastSync: string | null;
  kpis: Kpi[];
  series: { points: SpendPoint[]; skipped: number };
  buckets: Bucket[];
  tops: TopItem[];
  choices: Choice[];
  orders: HistoryOrder[];
  ordersLoading: boolean;
  plans: Plan[];
  plansLoading: boolean;
  onNavigate: (v: ViewKey) => void;
  onUsePlan: (p: Plan) => void;
  onUseOrder: (o: HistoryOrder) => void;
  onUseLatest: () => void;
  /** 主舞台输入框提交的一句话 */
  onSubmit: (text: string) => void;
}

/** 概览页默认展开几单。点趋势图定位到更靠后的一单时会临时放宽，见下方 rows */
const FEED_LIMIT = 6;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 概览页。
 *
 * 结构是一页「扉页 + 三段注脚」：
 *   1. 居中主舞台 —— 一句话点单，整页只允许存在一个动作；
 *   2. 统计条带 —— 四个衬线大数字，用发丝线切分，不装进任何卡片；
 *   3. 趋势 + 记忆 —— 左图右注，两个虚白面板；
 *   4. 方案清单与订单流 —— 通栏，点击就地展开。
 *
 * 所有统计都不进卡片，是因为卡片边界不携带信息，却把注意力切成了八份。
 * 三处联动都是真功能：点时段筛订单、点趋势点定位到那一单、点订单就地展开。
 */
export function Overview(props: OverviewProps) {
  const {
    mode,
    demoReason,
    kpis,
    series,
    buckets,
    tops,
    choices,
    orders,
    ordersLoading,
    plans,
    plansLoading,
    onNavigate,
    onUsePlan,
    onUseOrder,
    onUseLatest,
    onSubmit,
  } = props;

  const [bucket, setBucket] = useState<string | null>(null);
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [seed, setSeed] = useState('');
  const feedRef = useRef<HTMLDivElement>(null);

  const kpiOf = useCallback((key: string) => kpis.find((k) => k.key === key), [kpis]);
  const avg = kpiOf('avg');

  const top = tops[0] ?? null;
  const topShare = top && orders.length > 0 ? Math.round((top.count / orders.length) * 100) : 0;

  /* 累计实付：从真实订单算，且只累加接口确实返回了金额的那些 */
  const pricedCents = useMemo(() => orders.map(paidCents).filter((c): c is number => c !== null && c > 0), [orders]);
  const spendTotal = pricedCents.reduce((a, b) => a + b, 0);
  const pricedCount = pricedCents.length;

  const activeBucket = buckets.find((b) => b.key === bucket) ?? null;

  const filtered = useMemo(() => (bucket ? orders.filter((o) => bucketOf(o.createTime) === bucket) : orders), [orders, bucket]);

  // 筛选时把命中的单全部列出来（用户既然收窄了范围，就该看到收窄后的全部）；
  // 定位到某一单时，如果它排在默认条数之后，就把列表放宽到能包含它 —— 否则点了没反应
  const rows = useMemo(() => {
    const focusIdx = openOrder ? filtered.findIndex((o) => o.orderId === openOrder) : -1;
    const base = bucket ? Math.min(filtered.length, 20) : FEED_LIMIT;
    return filtered.slice(0, Math.max(base, focusIdx + 1));
  }, [filtered, openOrder, bucket]);

  const scrollToFeed = useCallback(() => {
    feedRef.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }, []);

  const pickBucket = (key: string | null) => {
    setBucket(key);
    setOpenOrder(null);
    if (key) window.setTimeout(scrollToFeed, 30);
  };

  const pickPoint = (p: SpendPoint) => {
    setBucket(null);
    setOpenOrder(p.orderId);
    window.setTimeout(scrollToFeed, 30);
  };

  const quickPrompts = useMemo(() => {
    const list = ['还是老样子'];
    if (top) list.push(`再来一份${top.name}`);
    list.push('不要薯条，换个别的', '预算 20 元以内');
    return list;
  }, [top]);

  const trendNote =
    series.points.length > 0 ? `近 ${series.points.length} 笔订单的实付金额 · 点一下定位到下面那一单` : '按时间正序';

  return (
    <div>
      {/* 主舞台 */}
      <Hero
        lastOrder={orders[0] ?? null}
        loading={ordersLoading}
        quickPrompts={quickPrompts}
        prefill={seed}
        demoReason={mode === 'demo' ? demoReason ?? '未连接真实 MCP' : undefined}
        onSubmit={(text) => {
          setSeed('');
          onSubmit(text);
        }}
        onUseLatest={onUseLatest}
      />

      {/*
        概况：一个主角 + 三个配角。
        不做四个等宽格子 —— 同样大小等于宣称同样重要，结果是谁都不重要。
        累计实付放大成唯一主角，其余退成一行次级数字。
      */}
      <section aria-label="消费概况" className="mt-14 md:mt-16">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-7">
          <MetricLead
            label="累计实付"
            value={spendTotal > 0 ? `¥${yuan(spendTotal)}` : '—'}
            note={
              pricedCount > 0
                ? `${pricedCount} 笔有金额 · ${orders.length - pricedCount} 笔接口未返回`
                : '接口还没有返回过实付金额'
            }
            loading={ordersLoading}
          />

          <MetricPair
            loading={ordersLoading}
            items={[
              { label: '累计下单', value: `${orders.length} 单` },
              { label: '平均客单价', value: avg?.value ?? '—' },
              { label: '最常点', value: top ? `${top.count} 次 · ${top.name}` : '—' },
              { label: '常用方案', value: `${plans.length} 个` },
            ]}
          />
        </div>

        <div className="hair mt-8" aria-hidden="true" />
      </section>

      {/* 趋势 + 记忆 */}
      <div className="mt-12 grid grid-cols-1 items-start gap-5 md:mt-14 md:gap-6 xl:grid-cols-12">
        {ordersLoading || series.points.length > 0 ? (
          <Panel className="min-w-0 px-5 py-6 md:px-8 md:py-8 xl:col-span-8">
            <SectionHead title="钱花在哪几单上" desc={trendNote} size="sm" />
            <div className="mt-5">
              {ordersLoading ? (
                <div className="skeleton h-[176px] w-full rounded-2xl" />
              ) : (
                <SpendTrend points={series.points} skipped={series.skipped} selectedId={openOrder} onPick={pickPoint} />
              )}
            </div>
          </Panel>
        ) : null}

        <Panel className="min-w-0 px-5 py-6 md:px-7 md:py-8 xl:col-span-4">
          <SectionHead title="我记住的" desc="全部由你的真实订单统计得出" size="sm" />
          <div className="mt-5">
            <MemoryRail
              top={top ? { name: top.name, count: top.count, share: topShare } : null}
              choices={choices}
              buckets={buckets}
              activeBucket={bucket}
              loading={ordersLoading}
              onPickBucket={pickBucket}
              onSeed={(text) => setSeed(text)}
            />
          </div>
        </Panel>
      </div>

      {/* 常用方案 */}
      <Panel className="mt-5 px-5 py-6 md:mt-6 md:px-8 md:py-8">
        <SectionHead
          title="常用方案"
          desc="方案存的是商品编码，不是一句话。价格每次下单前都会按门店重新核。"
          size="sm"
          action={
            <Button size="sm" onClick={() => onNavigate('plans')}>
              管理全部
            </Button>
          }
        />
        <div className="mt-4">
          <PlanList
            plans={plans}
            loading={plansLoading}
            onUse={onUsePlan}
            onManage={() => onNavigate('plans')}
            emptyAction={
              <Button variant="primary" size="sm" onClick={() => onNavigate('order')}>
                去调一单
              </Button>
            }
          />
        </div>
      </Panel>

      {/* 订单流 */}
      <div ref={feedRef} className="mt-10 scroll-mt-24 md:mt-12">
        <Panel className="px-5 py-6 md:px-8 md:py-8">
          <OrderFeed
            orders={rows}
            total={orders.length}
            matchCount={filtered.length}
            loading={ordersLoading}
            openId={openOrder}
            filterLabel={activeBucket ? `${activeBucket.label} ${activeBucket.range}` : null}
            onToggle={(id) => setOpenOrder((cur) => (cur === id ? null : id))}
            onUse={onUseOrder}
            onViewAll={() => onNavigate('orders')}
            onClearFilter={() => pickBucket(null)}
            emptyAction={
              <Button variant="primary" size="sm" onClick={onUseLatest}>
                <IconSparkle size={12} />
                还是老样子
              </Button>
            }
          />
        </Panel>
      </div>
    </div>
  );
}
