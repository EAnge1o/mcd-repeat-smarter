/**
 * 核价一致性与预算校验。
 *
 * 原则：金额只承认 MCP calculate-price 的返回值。
 * 本模块只做「校验」与「解释」，绝不自己算出总额去替代官方核价。
 */

import type { PlanItem, PriceBreakdown } from './types.js';

export interface PriceCheck {
  ok: boolean;
  warnings: string[];
  /** 核价行是否覆盖了请求的全部商品 */
  coveredAll: boolean;
  /** 行小计之和是否等于总额 */
  sumsMatch: boolean;
}

export function verifyBreakdown(breakdown: PriceBreakdown, items: PlanItem[]): PriceCheck {
  const warnings: string[] = [];

  const requested = new Set(items.map((i) => i.productCode));
  const priced = new Set(breakdown.lines.map((l) => l.productCode));
  const missing = [...requested].filter((code) => !priced.has(code));
  const coveredAll = missing.length === 0;

  if (!coveredAll) {
    warnings.push(`有 ${missing.length} 项商品没有出现在官方核价结果里，金额可能不完整`);
  }

  if (breakdown.lines.length === 0) {
    warnings.push('官方核价没有返回任何商品明细，请确认商品编码在当前门店是否可售');
  }

  const lineSum = breakdown.lines.reduce((s, l) => s + l.subtotalCents, 0);
  const sumsMatch = breakdown.lines.length === 0 ? false : Math.abs(lineSum - breakdown.priceCents) <= 1;
  if (breakdown.lines.length > 0 && !sumsMatch) {
    warnings.push(
      `明细合计 ¥${(lineSum / 100).toFixed(2)} 与实付 ¥${(breakdown.priceCents / 100).toFixed(2)} 不一致，可能包含未展开的优惠或费用`,
    );
  }

  if (breakdown.priceCents === 0 && items.length > 0) {
    warnings.push('实付金额为 0，可能是因为商品不可售或核价被忽略，请核对商品编码');
  }

  return { ok: warnings.length === 0, warnings, coveredAll, sumsMatch };
}

export interface BudgetCheck {
  within: boolean;
  overCents: number;
  message?: string;
}

export function checkBudget(priceCents: number, budgetCents: number | null): BudgetCheck {
  if (budgetCents === null) return { within: true, overCents: 0 };
  const over = priceCents - budgetCents;
  if (over <= 0) return { within: true, overCents: 0 };
  return {
    within: false,
    overCents: over,
    message: `超出预算 ¥${(over / 100).toFixed(2)}`,
  };
}

/** 方案对比：算出与原方案相比的价格差。 */
export function diffPrice(beforeCents: number | undefined, afterCents: number | undefined): number | null {
  if (beforeCents === undefined || afterCents === undefined) return null;
  return afterCents - beforeCents;
}

/** 分 → 展示用的元字符串 */
export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** 分 → 「¥12.5」这种更口语的展示（尽量少小数位） */
export function formatYuan(cents: number): string {
  const yuan = cents / 100;
  return Number.isInteger(yuan) ? `¥${yuan}` : `¥${yuan.toFixed(1)}`;
}
