/**
 * dashboard 的派生数据。
 *
 * 一条硬规则：**任何数字都必须能从真实订单算出来**。样本不够就显示「样本不足」，
 * 不为了填满图表去编趋势、编环比、编分类占比。
 *
 * 金额在领域层是「分」，历史订单的 paidYuan 是「元」字符串（可能是 "0" 或 null），
 * 这里统一只做一次换算，往下游只传分。
 */

import type { HistoryOrder, Plan } from '../../server/domain/types';

export const yuan = (cents: number) => (cents / 100).toFixed(2);

/** 历史订单的实付金额（分）。null = 接口没给，0 = 券/积分全额抵扣，两者含义不同。 */
export function paidCents(order: HistoryOrder): number | null {
  if (order.paidYuan === null || order.paidYuan === undefined || order.paidYuan === '') return null;
  const n = Number(order.paidYuan);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

const DAY = 86400_000;

function inWindow(iso: string, fromAgo: number, toAgo: number, now = Date.now()): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return t > now - fromAgo && t <= now - toAgo;
}

export type TrendDir = 'up' | 'down' | 'flat';

export interface Kpi {
  key: string;
  label: string;
  /** 大字号主体。是字符串而不是数字，因为有的指标主体是「13:00」这类非数值 */
  value: string;
  /** 主体后面跟的单位，比如「单」「元」 */
  unit?: string;
  hint: string;
  trend: { dir: TrendDir; text: string };
}

/** 环比文案。上一窗口没有样本时不下结论，只如实说明。 */
function deltaText(cur: number, prev: number, unit: string): { dir: TrendDir; text: string } {
  if (cur === 0 && prev === 0) return { dir: 'flat', text: `近 30 天没有新${unit}` };
  if (prev === 0) return { dir: 'up', text: `近 30 天新增 ${cur} ${unit}` };
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 1) return { dir: 'flat', text: `与上月持平` };
  return { dir: pct > 0 ? 'up' : 'down', text: `较上月 ${pct > 0 ? '+' : ''}${pct.toFixed(0)}%` };
}

/** 常点单品（按出现次数）。同一 productCode 累计 quantity。 */
export function topItems(orders: HistoryOrder[], limit = 5) {
  const map = new Map<string, { name: string; count: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = map.get(it.productCode);
      if (cur) {
        cur.count += it.quantity;
        // 名称可能随菜单更新变化，保留最近一次的名称
        cur.name = it.name;
      } else {
        map.set(it.productCode, { name: it.name, count: it.quantity });
      }
    }
  }
  return [...map.entries()]
    .map(([code, v]) => ({ productCode: code, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export interface Choice {
  name: string;
  count: number;
  /** 这个子项所属的套餐名，用来解释「选的是套餐里的哪一格」 */
  parentName: string;
}

/**
 * 套餐里最常选的子项。
 *
 * 这是比「最常点」更细一层的记忆：用户真正在意的是「红区配鸡排、蓝区配香芋派」这类搭配，
 * 而不是「又点了一次随心配」。历史订单里带了 children 才能算，没有就返回空数组。
 */
export function topChoices(orders: HistoryOrder[], limit = 2): Choice[] {
  const map = new Map<string, Choice>();
  for (const o of orders) {
    for (const it of o.items) {
      for (const c of it.children ?? []) {
        const key = c.code || c.name;
        const cur = map.get(key);
        if (cur) cur.count += c.quantity;
        else map.set(key, { name: c.name, count: c.quantity, parentName: it.name });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export function computeKpis(orders: HistoryOrder[], plans: Plan[]): Kpi[] {
  const now = Date.now();

  const curOrders = orders.filter((o) => inWindow(o.createTime, 30 * DAY, 0, now));
  const prevOrders = orders.filter((o) => inWindow(o.createTime, 60 * DAY, 30 * DAY, now));

  const priced = orders.map(paidCents).filter((c): c is number => c !== null && c > 0);
  const avgAll = priced.length > 0 ? priced.reduce((a, b) => a + b, 0) / priced.length : 0;

  const avgOf = (list: HistoryOrder[]) => {
    const v = list.map(paidCents).filter((c): c is number => c !== null && c > 0);
    return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };
  const avgCur = avgOf(curOrders);
  const avgPrev = avgOf(prevOrders);

  const top = topItems(orders, 1)[0];
  const share = top && orders.length > 0 ? Math.round((top.count / orders.length) * 100) : 0;

  const newPlans = plans.filter((p) => inWindow(p.createdAt, 30 * DAY, 0, now)).length;

  return [
    {
      key: 'orders',
      label: '累计下单',
      value: String(orders.length),
      unit: '单',
      hint: orders.length > 0 ? `最近一单 ${fmtDate(orders[0].createTime)}` : '还没有历史订单',
      trend: deltaText(curOrders.length, prevOrders.length, '单'),
    },
    {
      key: 'avg',
      label: '平均客单价',
      value: avgAll > 0 ? `¥${yuan(avgAll)}` : '—',
      hint: priced.length > 0 ? `基于 ${priced.length} 笔有金额订单` : '暂无金额数据',
      trend:
        avgCur > 0 && avgPrev > 0
          ? deltaText(Math.round(avgCur), Math.round(avgPrev), '元')
          : { dir: 'flat' as const, text: '样本不足，未做环比' },
    },
    {
      key: 'top',
      label: '最常点',
      value: top ? String(top.count) : '—',
      unit: top ? '次' : undefined,
      hint: top ? top.name : '还没有可统计的餐品',
      trend: top ? { dir: 'flat' as const, text: `出现在 ${share}% 的订单里` } : { dir: 'flat' as const, text: '暂无样本' },
    },
    {
      key: 'plans',
      label: '常用方案',
      value: String(plans.length),
      unit: '个',
      hint: plans.length > 0 ? `最近保存 ${fmtDate(plans[0].updatedAt)}` : '还没有保存过方案',
      trend: { dir: newPlans > 0 ? 'up' : 'flat', text: newPlans > 0 ? `近 30 天新增 ${newPlans} 个` : '近 30 天没有新增' },
    },
  ];
}

export interface SpendPoint {
  label: string;
  cents: number;
  orderId: string;
  storeName: string;
  time: string;
}

/** 近 N 笔有金额的订单，按时间正序。用于消费趋势折线。 */
export function spendSeries(orders: HistoryOrder[], n = 10): { points: SpendPoint[]; skipped: number } {
  const withPrice: SpendPoint[] = [];
  let skipped = 0;

  for (const o of orders) {
    const c = paidCents(o);
    if (c === null) {
      skipped += 1;
      continue;
    }
    withPrice.push({
      label: shortDate(o.createTime),
      cents: c,
      orderId: o.orderId,
      storeName: o.storeName,
      time: o.createTime,
    });
  }

  withPrice.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return { points: withPrice.slice(-n), skipped };
}

const HOUR_BUCKETS = [
  { key: 'breakfast', label: '早餐', range: '06–11', from: 6, to: 11 },
  { key: 'lunch', label: '午餐', range: '11–14', from: 11, to: 14 },
  { key: 'afternoon', label: '下午', range: '14–17', from: 14, to: 17 },
  { key: 'dinner', label: '晚餐', range: '17–21', from: 17, to: 21 },
  { key: 'night', label: '夜宵', range: '21–06', from: 21, to: 30 },
];

/**
 * 一单落在哪个时段桶。夜宵跨零点，所以把 0–6 点算成 24–30。
 *
 * 抽成独立函数是因为「统计各时段单量」和「点击时段筛选订单」必须用同一套判定，
 * 各写一份迟早会对不上（比如一边按 11 点算早餐、一边算午餐）。
 */
export function bucketOf(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  const hh = h < 6 ? h + 24 : h;
  return HOUR_BUCKETS.find((b) => hh >= b.from && hh < b.to)?.key ?? null;
}

export interface Bucket {
  key: string;
  label: string;
  range: string;
  count: number;
}

/** 下单时段分布。 */
export function hourBuckets(orders: HistoryOrder[]): Bucket[] {
  const buckets = HOUR_BUCKETS.map((b) => ({ ...b, count: 0 }));
  for (const o of orders) {
    const key = bucketOf(o.createTime);
    const hit = buckets.find((b) => b.key === key);
    if (hit) hit.count += 1;
  }
  return buckets.map(({ key, label, range, count }) => ({ key, label, range, count }));
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
