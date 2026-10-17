import { useCallback, useMemo, useRef, useState } from 'react';
import type { HistoryOrder, Plan } from '../../server/domain/types';
import { Button } from '../components/ui';
import { Hero } from '../components/Hero';
import { MemoryRail } from '../components/MemoryRail';
import { PlanList } from '../components/PlanList';
import { SpendTrend } from '../components/SpendTrend';
import { OrderFeed } from '../components/OrderFeed';
import { IconArrow, IconSparkle } from '../components/Icons';
import { bucketOf, type Bucket, type Choice, type Kpi, type SpendPoint } from '../lib/metrics';
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

/** 概览页默认展开几单。点趋势图定位到更靠后的一单时会临时放宽，见下方 limit */
const FEED_LIMIT = 6;

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 概览页。
 *
 * 版式不是「一排统计卡 + 三行图表」，而是一个主舞台加一条注解栏：
 * 左边是「现在下一单」（输入框 + 常点 + 方案快捷），右边是「你到底记住了我什么」。
 * 统计性质的趋势和订单历史放到页面下半部分，用通栏条带呈现 —— 它们是回看型信息，
 * 不该占掉首屏最贵的那块面积。
 *
 * 三处联动都是真功能，不是装饰：点时段筛订单、点趋势点定位到那一单、点订单就地展开。
 */
export function Overview(props: OverviewProps) {
  const {
    dateLabel,
    mode,
    demoReason,
    storeName,
    lastSync,
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
  const total = kpiOf('orders');

  const top = tops[0] ?? null;
  const topShare = top && orders.length > 0 ? Math.round((top.count / orders.length) * 100) : 0;

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
    series.points.length > 0 ? `近 ${series.points.length} 笔订单的实付金额` : '按时间正序';

  return (
    <div>
      {/* 页头：一行元信息，不抢标题的注意力 */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
        <p className="min-w-0 truncate text-[11.5px] text-[#6f6a62]">
          <span className="tnum">{dateLabel}</span>
          {storeName ? (
            <>
              <span className="px-1.5 text-[#b3afa7]">/</span>
              <span className="text-[#57534c]">{storeName}</span>
            </>
          ) : null}
        </p>
        <p className="flex shrink-0 items-center gap-1.5 text-[11px] text-[#6f6a62]">
          <span
            className={mode === 'live' ? 'inline-block h-1.5 w-1.5 rounded-full bg-[#22c55e]' : 'inline-block h-1.5 w-1.5 rounded-full bg-[#f59e0b]'}
            aria-hidden="true"
          />
          {mode === 'live' ? 'MCP 实时数据' : '演示数据'}
          {lastSync ? <span className="tnum">· {lastSync} 读取</span> : null}
        </p>
      </header>

      {/* 主区：左舞台 + 右注解栏 */}
      <div className="mt-6 grid gap-x-10 gap-y-9 md:mt-8 xl:grid-cols-12 xl:items-start">
        <div className="min-w-0 space-y-7 xl:col-span-8 xl:space-y-8">
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

          <section aria-labelledby="plans-title" className="border-t border-line pt-5">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <h2 id="plans-title" className="text-[15px] font-semibold tracking-tight text-[#111827]">
                  常用方案
                </h2>
                <span className="tnum text-[11px] text-[#6f6a62]">{plans.length} 个</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('plans')}
                className="group inline-flex items-center gap-1 rounded-md py-0.5 text-[11.5px] font-medium text-[#57534c] transition-colors duration-150 hover:text-brand-600"
              >
                管理
                <IconArrow size={11} className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            </div>

            <PlanList
              plans={plans}
              loading={plansLoading}
              onUse={onUsePlan}
              onManage={() => onNavigate('plans')}
              emptyAction={
                <Button variant="primary" size="sm" onClick={() => onNavigate('order')}>
                  <IconSparkle size={13} />
                  去调一单
                </Button>
              }
            />
          </section>
        </div>

        <div className="min-w-0 border-t border-line pt-6 xl:col-span-4 xl:border-t-0 xl:pt-0">
          <MemoryRail
            top={top ? { name: top.name, count: top.count, share: topShare } : null}
            choices={choices}
            avg={{ value: avg?.value ?? '—', hint: avg?.hint ?? '接口未返回金额' }}
            total={{ value: total?.value ?? '0', unit: total?.unit, hint: total?.hint ?? '还没有历史订单' }}
            buckets={buckets}
            activeBucket={bucket}
            loading={ordersLoading}
            onPickBucket={pickBucket}
            onSeed={(text) => setSeed(text)}
          />
        </div>
      </div>

      {/* 趋势条带：通栏，不包卡片。一条金额都没有时整段不出现，免得堆三个空状态 */}
      {ordersLoading || series.points.length > 0 ? (
        <section aria-labelledby="trend-title" className="mt-9 border-t border-line pt-6 md:mt-11 md:pt-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="trend-title" className="text-[15px] font-semibold tracking-tight text-[#111827]">
              消费趋势
            </h2>
            <p className="text-[11px] text-[#6f6a62]">
              {trendNote}
              {series.points.length > 0 ? <span className="hidden sm:inline"> · 点一下可定位到下面那一单</span> : null}
            </p>
          </div>
          <div className="mt-3">
            {ordersLoading ? (
              <div className="skeleton h-[168px] w-full" />
            ) : (
              <SpendTrend points={series.points} skipped={series.skipped} selectedId={openOrder} onPick={pickPoint} />
            )}
          </div>
        </section>
      ) : null}

      {/* 订单流：通栏，就地展开 */}
      <div ref={feedRef} className="mt-9 scroll-mt-20 md:mt-11">
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
              <IconSparkle size={13} />
              还是老样子
            </Button>
          }
        />
      </div>
    </div>
  );
}
