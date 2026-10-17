import { describe, expect, it } from 'vitest';
import type { ComboDetail, MenuProduct, PlanItem } from '../server/domain/types';
import { parseIntent } from '../server/domain/intent';
import { applyIntent, buildCandidates, locateTarget, markBudget } from '../server/domain/planner';

const menu: MenuProduct[] = [
  { code: '9900013304', name: '人气经典随心配', priceCents: 1490, originalPriceCents: 1490, tags: [], categories: [] },
  { code: '1401', name: '麦乐鸡5块', priceCents: 1450, originalPriceCents: 1450, tags: [], categories: [] },
  { code: '4106', name: '香芋派', priceCents: 800, originalPriceCents: 800, tags: [], categories: [] },
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

const basePlan: PlanItem[] = [
  {
    productCode: '9900013304',
    name: '人气经典随心配',
    quantity: 1,
    isCombo: true,
    children: [
      { code: '521156', name: '那么大鸡排（椒盐风味）', quantity: 1, round: '1', roundName: '蓝区' },
      { code: '4106', name: '香芋派', quantity: 1, round: '2', roundName: '粉区' },
    ],
  },
];

describe('定位用户说的目标', () => {
  it('能定位到套餐子项', () => {
    const t = locateTarget('香芋派', basePlan);
    expect(t).toEqual({ itemIndex: 0, childIndex: 1 });
  });

  it('能定位到整项', () => {
    const t = locateTarget('随心配', basePlan);
    expect(t?.itemIndex).toBe(0);
  });

  it('能通过历史别名定位（换码后用户仍说旧名）', () => {
    const withAlias: PlanItem[] = [
      {
        ...basePlan[0],
        name: '人气经典随心配',
        aliasNames: ['随心配1+1'],
      },
    ];
    expect(locateTarget('随心配1+1', withAlias)?.itemIndex).toBe(0);
  });

  it('找不到时返回 undefined，不强行匹配', () => {
    expect(locateTarget('龙虾', basePlan)).toBeUndefined();
  });
});

describe('保留未修改的内容', () => {
  it('只说「还是老样子」时方案完全不变', () => {
    const { items, changes } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('还是老样子'), menu, combos },
      basePlan,
    );
    expect(items).toEqual(basePlan);
    expect(changes.every((c) => c.type === 'kept')).toBe(true);
  });

  it('只改一项时，另一项必须原样保留', () => {
    const { items } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('不要香芋派，换个东西'), menu, combos },
      basePlan,
    );
    const children = items[0].children;
    // 蓝区的鸡排没有被要求修改，必须保留
    expect(children.find((c) => c.code === '521156')).toBeDefined();
  });
});

describe('删除与替换子项', () => {
  it('删掉套餐子项后会补位，保证轮次完整', () => {
    const { items, changes } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('不要香芋派'), menu, combos },
      basePlan,
    );
    const pinkRound = items[0].children.filter((c) => c.round === '2');
    expect(pinkRound).toHaveLength(1);
    expect(pinkRound[0].code).not.toBe('4106');
    expect(changes.some((c) => c.type === 'removed')).toBe(true);
  });

  it('「换个东西」会真的换成不同的项', () => {
    const { items } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('香芋派换成菠萝派'), menu, combos },
      basePlan,
    );
    const pink = items[0].children.find((c) => c.round === '2');
    expect(pink?.code).toBe('4107');
    expect(pink?.name).toBe('菠萝派');
  });

  it('替换后仍保留轮次归属', () => {
    const { items } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('香芋派换成菠萝派'), menu, combos },
      basePlan,
    );
    const pink = items[0].children.find((c) => c.round === '2');
    expect(pink?.roundName).toBe('粉区');
  });
});

describe('新增商品', () => {
  it('加一份麦乐鸡会追加为独立项', () => {
    const { items } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('加一份麦乐鸡'), menu, combos },
      basePlan,
    );
    expect(items).toHaveLength(2);
    expect(items[1].productCode).toBe('1401');
  });

  it('菜单里没有的商品不会被硬凑', () => {
    const { changes } = applyIntent(
      { baseItems: basePlan, intent: parseIntent('加一份龙虾'), menu, combos },
      basePlan,
    );
    expect(changes.some((c) => c.type === 'unavailable')).toBe(true);
  });
});

describe('预算判定', () => {
  const candidate = {
    id: 'x',
    label: '测试',
    strategy: 'minimal' as const,
    items: basePlan,
    changes: [],
    withinBudget: null,
    explain: [],
    price: {
      priceCents: 1690,
      originalPriceCents: 1690,
      discountCents: 0,
      lines: [],
      takeWayList: [],
      fetchedAt: new Date().toISOString(),
      source: 'mcp' as const,
    },
  };

  it('未设预算时不判定', () => {
    expect(markBudget(candidate, null).withinBudget).toBeNull();
  });

  it('超预算时明确标出超出多少', () => {
    const r = markBudget(candidate, 1600);
    expect(r.withinBudget).toBe(false);
    expect(r.budgetNote).toContain('0.90');
  });

  it('在预算内时不带告警', () => {
    const r = markBudget(candidate, 2000);
    expect(r.withinBudget).toBe(true);
    expect(r.budgetNote).toBeUndefined();
  });
});

describe('候选方案生成', () => {
  it('默认只给一个最小改动方案，不制造噪音', () => {
    const cs = buildCandidates({ baseItems: basePlan, intent: parseIntent('不要香芋派'), menu, combos });
    expect(cs[0].id).toBe('minimal');
  });

  it('开放式替换时额外给一个搭配思路', () => {
    const cs = buildCandidates({ baseItems: basePlan, intent: parseIntent('不要香芋派，换个东西'), menu, combos });
    expect(cs.length).toBeGreaterThanOrEqual(2);
    expect(cs.some((c) => c.id === 'swap-alt')).toBe(true);
  });
});
