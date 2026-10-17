import { describe, expect, it } from 'vitest';
import type { ComboDetail, MenuProduct, PlanItem } from '../server/domain/types';
import {
  coreWord,
  findBestProduct,
  inferRound,
  matchItem,
  matchPlan,
  nameSimilarity,
  normalizeName,
  summarizeMatch,
} from '../server/domain/matcher';

const menu: MenuProduct[] = [
  { code: '9900013304', name: '人气经典随心配', priceCents: 1490, originalPriceCents: 1490, tags: [], categories: ['随心配'] },
  { code: '9900015568', name: '精选超值随心配', priceCents: 1390, originalPriceCents: 1390, tags: [], categories: ['随心配'] },
  { code: '1440', name: '麦辣鸡腿汉堡', priceCents: 2250, originalPriceCents: 2250, tags: [], categories: ['汉堡'] },
  { code: '521156', name: '那么大鸡排（椒盐风味）', priceCents: 1400, originalPriceCents: 1400, tags: [], categories: ['炸鸡'] },
];

const combo: ComboDetail = {
  code: '9900013304',
  name: '人气经典随心配',
  supportModify: true,
  rounds: [
    {
      id: 1,
      name: '蓝区',
      quantity: 1,
      minQuantity: 1,
      maxQuantity: 1,
      choices: [
        { code: '1001', name: '双层吉士汉堡', isDefault: true, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
        { code: '521156', name: '那么大鸡排（椒盐风味）', isDefault: false, diffPrice: '- ¥1', diffPriceCents: -100, supportModify: false },
      ],
    },
    {
      id: 2,
      name: '粉区',
      quantity: 1,
      minQuantity: 1,
      maxQuantity: 1,
      choices: [
        { code: '4106', name: '香芋派', isDefault: true, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
        { code: '4107', name: '菠萝派', isDefault: false, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
        { code: '4420', name: '迷你草莓新地', isDefault: false, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
      ],
    },
  ],
};

const combos = new Map<string, ComboDetail>([['9900013304', combo]]);

describe('名称归一化与相似度', () => {
  it('去掉括号补充说明', () => {
    expect(normalizeName('那么大鸡排（椒盐风味）')).toBe('那么大鸡排');
  });

  it('提取中文核心词', () => {
    expect(coreWord('随心配1+1')).toBe('随心配');
    expect(coreWord('人气经典随心配')).toBe('人气经典随心配');
  });

  it('同名得 1 分', () => {
    expect(nameSimilarity('香芋派', '香芋派')).toBe(1);
  });

  it('「随心配1+1」能匹配到「人气经典随心配」', () => {
    // 这是真实数据的核心场景：历史套餐已下架，需要按核心词找回同类商品
    expect(nameSimilarity('随心配1+1', '人气经典随心配')).toBeGreaterThan(0.62);
  });

  it('毫不相干的商品不会被误配', () => {
    expect(nameSimilarity('香芋派', '麦辣鸡腿汉堡')).toBeLessThan(0.3);
  });
});

describe('口语 → 商品', () => {
  it('能从菜单里找到最接近的商品', () => {
    const hit = findBestProduct('麦辣鸡腿堡', menu, 0.5);
    expect(hit?.code).toBe('1440');
  });

  it('找不到时返回 undefined 而不是乱配', () => {
    expect(findBestProduct('完全不存在的东西', menu, 0.6)).toBeUndefined();
  });
});

describe('餐品身份匹配', () => {
  it('编码仍在售 → exact', () => {
    const item: PlanItem = { productCode: '1440', name: '麦辣鸡腿汉堡', quantity: 1, children: [], isCombo: false };
    const m = matchItem(item, { menu, combos });
    expect(m.status).toBe('exact');
    expect(m.current?.productCode).toBe('1440');
  });

  it('历史套餐下架但同名在售 → renamed 并保留子项', () => {
    const item: PlanItem = {
      productCode: '9900013291',
      name: '精选超值随心配',
      quantity: 1,
      isCombo: true,
      children: [{ code: '521156', name: '那么大鸡排（椒盐风味）', quantity: 1 }],
    };
    const m = matchItem(item, { menu, combos });
    expect(m.status).toBe('renamed');
    expect(m.current?.productCode).toBe('9900015568');
  });

  it('历史套餐名不同但核心词相同 → 模糊匹配到在售套餐', () => {
    const item: PlanItem = {
      productCode: '9900010829',
      name: '随心配1+1',
      quantity: 1,
      isCombo: true,
      children: [
        { code: '521156', name: '那么大鸡排（椒盐风味）', quantity: 1 },
        { code: '4106', name: '香芋派', quantity: 1 },
      ],
    };
    const m = matchItem(item, { menu, combos });
    expect(m.status).toBe('renamed');
    expect(m.current?.productCode).toBe('9900013304');
    // 子项在当前套餐里仍可点，且自动补上轮次归属
    expect(m.children.every((c) => c.status === 'exact')).toBe(true);
    expect(m.current?.children.map((c) => c.round)).toEqual(['1', '2']);
    expect(m.current?.children.map((c) => c.roundName)).toEqual(['蓝区', '粉区']);
  });

  it('子项编码失效但套餐内有同名项 → renamed 并修正轮次归属', () => {
    const item: PlanItem = {
      productCode: '9900013304',
      name: '人气经典随心配',
      quantity: 1,
      isCombo: true,
      children: [{ code: '9999', name: '香芋派', quantity: 1 }],
    };
    const m = matchItem(item, { menu, combos });
    expect(m.children[0].status).toBe('renamed');
    expect(m.children[0].current?.code).toBe('4106');
    // 历史订单不带轮次，这里必须按当前套餐定义纠正到「粉区」
    expect(m.children[0].current?.round).toBe('2');
    expect(m.children[0].current?.roundName).toBe('粉区');
  });

  it('套餐里确实没有该项时 → substituted 并给出替代', () => {
    const item: PlanItem = {
      productCode: '9900013304',
      name: '人气经典随心配',
      quantity: 1,
      isCombo: true,
      children: [{ code: '8888', name: '上世纪的甜品', quantity: 1 }],
    };
    const m = matchItem(item, { menu, combos });
    expect(m.children[0].status).toBe('substituted');
    expect(m.children[0].current).toBeDefined();
    expect(m.children[0].reason).toContain('已下架');
  });

  it('完全找不到的商品标记为已下架', () => {
    const item: PlanItem = { productCode: '0000', name: '上世纪的汉堡', quantity: 1, children: [], isCombo: false };
    const m = matchItem(item, { menu, combos });
    expect(m.status).toBe('unavailable');
    expect(m.notes[0]).toContain('不在售');
  });

  it('替换后保留别名，便于用户继续用旧称提修改', () => {
    const item: PlanItem = {
      productCode: '9900010829',
      name: '随心配1+1',
      quantity: 1,
      isCombo: true,
      children: [],
    };
    const m = matchItem(item, { menu, combos });
    // 商品被重匹配成「人气经典随心配」，但旧称必须保留下来
    expect(m.current?.productCode).toBe('9900013304');
    expect(m.current?.aliasNames).toContain('随心配1+1');
  });
});

describe('轮次推断与汇总', () => {
  it('按当前套餐定义反查轮次', () => {
    expect(inferRound('521156', 0, combo).round).toBe('1');
    expect(inferRound('4106', 0, combo).round).toBe('2');
  });

  it('反查不到时按顺序兜底', () => {
    expect(inferRound('unknown', 1, combo).round).toBe('2');
  });

  it('汇总能识别风险', () => {
    const items: PlanItem[] = [
      { productCode: '1440', name: '麦辣鸡腿汉堡', quantity: 1, children: [], isCombo: false },
      { productCode: '0000', name: '上世纪的汉堡', quantity: 1, children: [], isCombo: false },
    ];
    const s = summarizeMatch(matchPlan(items, { menu, combos }));
    expect(s.exact).toBe(1);
    expect(s.unavailable).toBe(1);
    expect(s.hasRisk).toBe(true);
  });
});
