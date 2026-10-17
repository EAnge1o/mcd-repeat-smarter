import { describe, expect, it } from 'vitest';
import type { PlanItem, PriceBreakdown } from '../server/domain/types';
import { checkBudget, diffPrice, formatCents, formatYuan, verifyBreakdown } from '../server/domain/pricing';
import { parseDiffPrice, yuanToCents } from '../server/mcp/mcdService';

const items: PlanItem[] = [
  { productCode: '9900013304', name: '人气经典随心配', quantity: 1, children: [], isCombo: true },
];

const good: PriceBreakdown = {
  priceCents: 1390,
  originalPriceCents: 1390,
  discountCents: 0,
  lines: [
    { productCode: '9900013304', productName: '人气经典随心配', quantity: 1, subtotalCents: 1390, originalSubtotalCents: 1390 },
  ],
  takeWayList: [{ code: 'eat-in', title: '堂食', subtitle: '店内用餐' }],
  fetchedAt: new Date().toISOString(),
  source: 'mcp',
};

describe('金额单位换算（真实数据的坑）', () => {
  it('菜单里的「元」字符串转成「分」', () => {
    expect(yuanToCents('14.9')).toBe(1490);
    expect(yuanToCents('34.5')).toBe(3450);
    expect(yuanToCents(0)).toBe(0);
    expect(yuanToCents(undefined)).toBe(0);
  });

  it('解析差价格式「+ ¥2.5」「- ¥1」「+ ¥0」', () => {
    expect(parseDiffPrice('+ ¥2.5')).toBe(250);
    expect(parseDiffPrice('- ¥1')).toBe(-100);
    expect(parseDiffPrice('+ ¥0')).toBe(0);
    expect(parseDiffPrice(undefined)).toBe(0);
  });
});

describe('核价一致性校验', () => {
  it('明细与总额一致时通过', () => {
    const c = verifyBreakdown(good, items);
    expect(c.ok).toBe(true);
    expect(c.coveredAll).toBe(true);
    expect(c.sumsMatch).toBe(true);
  });

  it('请求的商品没出现在核价结果里要报警', () => {
    const c = verifyBreakdown(good, [...items, { productCode: '9999', name: '幽灵商品', quantity: 1, children: [], isCombo: false }]);
    expect(c.coveredAll).toBe(false);
    expect(c.warnings.some((w) => w.includes('没有出现在官方核价'))).toBe(true);
  });

  it('明细为空要报警', () => {
    const empty: PriceBreakdown = { ...good, priceCents: 0, originalPriceCents: 0, lines: [] };
    const c = verifyBreakdown(empty, items);
    expect(c.ok).toBe(false);
  });

  it('实付为 0 且存在商品要报警（多半是编码不可售）', () => {
    const zero: PriceBreakdown = {
      ...good,
      priceCents: 0,
      lines: [{ productCode: '9900013304', productName: 'x', quantity: 1, subtotalCents: 0, originalSubtotalCents: 0 }],
    };
    const c = verifyBreakdown(zero, items);
    expect(c.warnings.some((w) => w.includes('实付金额为 0'))).toBe(true);
  });

  it('明细合计与总额不符要报警', () => {
    const bad: PriceBreakdown = { ...good, priceCents: 9999 };
    const c = verifyBreakdown(bad, items);
    expect(c.sumsMatch).toBe(false);
    expect(c.warnings.some((w) => w.includes('不一致'))).toBe(true);
  });
});

describe('预算与展示', () => {
  it('未设预算视为通过', () => {
    expect(checkBudget(9999, null).within).toBe(true);
  });

  it('超预算返回差额', () => {
    const r = checkBudget(1690, 1600);
    expect(r.within).toBe(false);
    expect(r.overCents).toBe(90);
  });

  it('价格差不计算缺失值', () => {
    expect(diffPrice(undefined, 100)).toBeNull();
    expect(diffPrice(1000, 1390)).toBe(390);
  });

  it('金额格式化', () => {
    expect(formatCents(1390)).toBe('13.90');
    expect(formatYuan(1390)).toBe('¥13.9');
    expect(formatYuan(1400)).toBe('¥14');
  });
});
