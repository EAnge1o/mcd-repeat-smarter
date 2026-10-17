/**
 * 习惯挖掘：只从 MCP 真实返回的历史订单里统计，不做任何猜测或补全。
 *
 * 这一层是产品「老样子」文案的唯一数据来源。
 * 如果历史订单为空，headline 必须诚实地说明没有样本，而不是编造偏好。
 */

import type { HabitProfile, HistoryOrder } from './types.js';

export function hourLabel(hour: number): string {
  if (hour >= 5 && hour < 10) return '早餐';
  if (hour >= 10 && hour < 14) return '午餐';
  if (hour >= 14 && hour < 17) return '下午茶';
  if (hour >= 17 && hour < 21) return '晚餐';
  return '夜宵';
}

function hourOf(createTime: string): number | undefined {
  // MCP 格式：2026-07-06 12:12:04
  const match = createTime.match(/\s(\d{1,2}):/);
  if (!match) return undefined;
  const h = Number.parseInt(match[1], 10);
  return Number.isFinite(h) && h >= 0 && h <= 23 ? h : undefined;
}

interface Counter {
  key: string;
  name: string;
  count: number;
  extra?: string;
}

function topN(map: Map<string, Counter>, n: number): Counter[] {
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);
}

export function buildHabitProfile(orders: HistoryOrder[]): HabitProfile {
  const sampleSize = orders.length;

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      topItems: [],
      topChildren: [],
      headline: '还没有历史订单，先手动挑一份，存成你的「老样子」吧。',
    };
  }

  const storeCounter = new Map<string, Counter>();
  const itemCounter = new Map<string, Counter>();
  const childCounter = new Map<string, Counter>();
  const hourCounter = new Map<number, number>();

  for (const order of orders) {
    storeCounter.set(order.storeCode, {
      key: order.storeCode,
      name: order.storeName,
      count: (storeCounter.get(order.storeCode)?.count ?? 0) + 1,
    });

    for (const item of order.items) {
      // 同一单里同款出现多次，按出现次数累加更贴近真实频次
      const prev = itemCounter.get(item.productCode);
      itemCounter.set(item.productCode, {
        key: item.productCode,
        name: item.name,
        count: (prev?.count ?? 0) + item.quantity,
      });

      for (const child of item.children) {
        const prevChild = childCounter.get(child.code);
        childCounter.set(child.code, {
          key: child.code,
          name: child.name,
          count: (prevChild?.count ?? 0) + child.quantity,
          extra: item.name,
        });
      }
    }

    const hour = hourOf(order.createTime);
    if (hour !== undefined) {
      hourCounter.set(hour, (hourCounter.get(hour) ?? 0) + 1);
    }
  }

  const topStoreEntry = topN(storeCounter, 1)[0];
  const topItems = topN(itemCounter, 5).map((c) => ({ productCode: c.key, name: c.name, count: c.count }));
  const topChildren = topN(childCounter, 5).map((c) => ({
    code: c.key,
    name: c.name,
    count: c.count,
    parentName: c.extra ?? '',
  }));

  let topHour: HabitProfile['topHour'];
  if (hourCounter.size > 0) {
    const [hour, count] = [...hourCounter.entries()].sort((a, b) => b[1] - a[1])[0];
    topHour = { hour, label: hourLabel(hour), count };
  }

  const latestOrder = [...orders].sort((a, b) => b.createTime.localeCompare(a.createTime))[0];

  return {
    sampleSize,
    topStore: topStoreEntry
      ? { storeCode: topStoreEntry.key, storeName: topStoreEntry.name, count: topStoreEntry.count }
      : undefined,
    topItems,
    topChildren,
    topHour,
    latestOrder,
    headline: buildHeadline(sampleSize, topItems, topChildren, topHour, topStoreEntry),
  };
}

function buildHeadline(
  sampleSize: number,
  topItems: { name: string; count: number }[],
  topChildren: { name: string; count: number }[],
  topHour?: { hour: number; label: string; count: number },
  topStore?: Counter,
): string {
  const parts: string[] = [];

  const main = topItems[0];
  if (main && main.count > 1) {
    parts.push(`最近 ${sampleSize} 单里，${main.name}出现了 ${main.count} 次`);
  } else if (main) {
    parts.push(`最近 ${sampleSize} 单里最常点的是${main.name}`);
  }

  const child = topChildren[0];
  if (child && child.count > 1) {
    parts.push(`常配${child.name}`);
  }

  if (topHour) {
    parts.push(`通常${topHour.label}下单`);
  }

  if (parts.length === 0) {
    return `一共有 ${sampleSize} 单历史记录，点「还是老样子」就能接着点。`;
  }

  const storeText = topStore && topStore.count === sampleSize ? `，都在${topStore.name}` : '';
  return `${parts.join('，')}${storeText}。`;
}
