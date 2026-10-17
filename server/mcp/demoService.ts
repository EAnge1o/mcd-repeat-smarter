/**
 * 演示实现（不需要 Token）。
 *
 * 严格约束：
 * - 所有返回值 source 都是 'demo'，UI 必须显著标注「演示数据」。
 * - 演示数据为虚构构造，不代表任何真实门店的价格与供应情况。
 * - 该实现存在的唯一目的，是让拿到仓库的人在没有 MCP Token 时也能走通界面与流程。
 */

import type {
  BeType,
  ComboDetail,
  Coupon,
  HistoryOrder,
  MenuProduct,
  PlanItem,
  PriceBreakdown,
  Store,
} from '../domain/types.js';
import { beTypeToOrderType } from '../domain/types.js';
import type { CreateOrderResult, McdGateway } from './gateway.js';

const DEMO_STORE: Store = {
  storeCode: '1000001',
  storeName: '麦当劳示例中心餐厅（演示）',
  address: '示例市示例路 1 号 101 室',
  distance: 320,
  businessStatus: true,
  businessStartTime: '06:30',
  businessEndTime: '23:00',
  reservationTimeOptions: [
    { date: '2026-10-17', today: true, reservationOptionText: '夜市(17:14至21:45)' },
  ],
};

const DEMO_MENU: MenuProduct[] = [
  { code: '9900000001', name: '经典牛肉堡三件套', priceCents: 3100, originalPriceCents: 4100, tags: ['套餐'], categories: ['套餐'] },
  { code: '1001', name: '经典牛肉堡', priceCents: 1800, originalPriceCents: 1800, tags: [], categories: ['汉堡'] },
  { code: '1002', name: '炸鸡腿堡', priceCents: 1900, originalPriceCents: 1900, tags: [], categories: ['汉堡'] },
  { code: '1012', name: '那么大鸡排（椒盐风味）', priceCents: 1400, originalPriceCents: 1400, tags: [], categories: ['炸鸡'] },
  { code: '1003', name: '香脆鸡块5块', priceCents: 1200, originalPriceCents: 1200, tags: [], categories: ['炸鸡'] },
  { code: '1004', name: '中薯条', priceCents: 1100, originalPriceCents: 1100, tags: [], categories: ['小食'] },
  { code: '1011', name: '小薯条', priceCents: 900, originalPriceCents: 900, tags: [], categories: ['小食'] },
  { code: '1005', name: '玉米杯', priceCents: 1000, originalPriceCents: 1000, tags: [], categories: ['小食'] },
  { code: '1007', name: '苹果派', priceCents: 800, originalPriceCents: 800, tags: [], categories: ['甜品'] },
  { code: '1013', name: '麦旋风', priceCents: 1200, originalPriceCents: 1200, tags: [], categories: ['甜品'] },
  { code: '1008', name: '可乐中杯', priceCents: 900, originalPriceCents: 900, tags: [], categories: ['饮料'] },
  { code: '1009', name: '无糖可乐中杯', priceCents: 900, originalPriceCents: 900, tags: [], categories: ['饮料'] },
  { code: '1010', name: '鲜煮咖啡', priceCents: 1000, originalPriceCents: 1000, tags: [], categories: ['饮料'] },
  { code: '1014', name: '橙汁', priceCents: 1100, originalPriceCents: 1100, tags: [], categories: ['饮料'] },
  // 注意：香芋派（1006）刻意不在当前菜单中，用于演示「历史商品已下架」的真实场景
];

const DEMO_COMBO: ComboDetail = {
  code: '9900000001',
  name: '经典牛肉堡三件套',
  supportModify: true,
  rounds: [
    {
      id: 1,
      name: '主餐',
      quantity: 1,
      minQuantity: 1,
      maxQuantity: 1,
      choices: [
        { code: '1001', name: '经典牛肉堡', isDefault: true, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: true },
        { code: '1002', name: '炸鸡腿堡', isDefault: false, diffPrice: '+ ¥1', diffPriceCents: 100, supportModify: true },
      ],
    },
    {
      id: 2,
      name: '配餐',
      quantity: 1,
      minQuantity: 1,
      maxQuantity: 1,
      choices: [
        { code: '1004', name: '中薯条', isDefault: true, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
        { code: '1011', name: '小薯条', isDefault: false, diffPrice: '- ¥2', diffPriceCents: -200, supportModify: false },
        { code: '1005', name: '玉米杯', isDefault: false, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
        { code: '1007', name: '苹果派', isDefault: false, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: false },
      ],
    },
    {
      id: 3,
      name: '饮料',
      quantity: 1,
      minQuantity: 1,
      maxQuantity: 1,
      choices: [
        { code: '1008', name: '可乐中杯', isDefault: true, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: true },
        { code: '1009', name: '无糖可乐中杯', isDefault: false, diffPrice: '+ ¥0', diffPriceCents: 0, supportModify: true },
        { code: '1010', name: '鲜煮咖啡', isDefault: false, diffPrice: '+ ¥1', diffPriceCents: 100, supportModify: true },
      ],
    },
  ],
};

const DEMO_HISTORY: HistoryOrder[] = [
  {
    orderId: 'DEMO-0003',
    createTime: '2026-10-16 12:05:41',
    storeCode: DEMO_STORE.storeCode,
    storeName: DEMO_STORE.storeName,
    beType: 1,
    orderStatus: '订单已完成（演示）',
    paidYuan: '36.0',
    items: [
      {
        productCode: '9900000001',
        name: '经典牛肉堡三件套',
        quantity: 1,
        isCombo: true,
        children: [
          { code: '1001', name: '经典牛肉堡', quantity: 1 },
          { code: '1004', name: '中薯条', quantity: 1 },
          { code: '1008', name: '可乐中杯', quantity: 1 },
        ],
      },
    ],
  },
  {
    orderId: 'DEMO-0002',
    createTime: '2026-10-15 12:20:13',
    storeCode: DEMO_STORE.storeCode,
    storeName: DEMO_STORE.storeName,
    beType: 1,
    orderStatus: '订单已完成（演示）',
    paidYuan: '26.0',
    items: [
      {
        productCode: '9900000001',
        name: '经典牛肉堡三件套',
        quantity: 1,
        isCombo: true,
        children: [
          { code: '1002', name: '炸鸡腿堡', quantity: 1 },
          { code: '1005', name: '玉米杯', quantity: 1 },
          { code: '1009', name: '无糖可乐中杯', quantity: 1 },
        ],
      },
    ],
  },
  {
    orderId: 'DEMO-0001',
    createTime: '2026-10-14 08:12:07',
    storeCode: DEMO_STORE.storeCode,
    storeName: DEMO_STORE.storeName,
    beType: 1,
    orderStatus: '订单已完成（演示）',
    paidYuan: '39.0',
    items: [
      {
        productCode: '9900000001',
        name: '经典牛肉堡三件套',
        quantity: 1,
        isCombo: true,
        children: [
          { code: '1001', name: '经典牛肉堡', quantity: 1 },
          { code: '1004', name: '中薯条', quantity: 1 },
          { code: '1008', name: '可乐中杯', quantity: 1 },
        ],
      },
      // 这一项在当前菜单已不存在，用于演示「已下架」的识别与替代
      { productCode: '1006', name: '香芋派', quantity: 1, children: [], isCombo: false },
    ],
  },
];

const priceOf = (code: string): number => DEMO_MENU.find((p) => p.code === code)?.priceCents ?? 0;

export class DemoService implements McdGateway {
  readonly mode = 'demo' as const;

  async findStores(): Promise<Store[]> {
    return [DEMO_STORE];
  }

  async getMenu(): Promise<{ products: MenuProduct[]; orderType: number }> {
    return { products: DEMO_MENU, orderType: 1 };
  }

  async getComboDetail(_storeCode: string, code: string): Promise<ComboDetail> {
    if (code !== DEMO_COMBO.code) {
      return { code, name: '（演示）该商品无套餐选项', supportModify: false, rounds: [] };
    }
    return DEMO_COMBO;
  }

  async getHistory(): Promise<HistoryOrder[]> {
    return DEMO_HISTORY;
  }

  async getMyCoupons(): Promise<Coupon[]> {
    return [
      { id: 'DEMO-COUPON-1', code: 'DEMO123', title: '（演示）中杯可乐 5 元券' },
    ];
  }

  async calcPrice(_storeCode: string, _beType: BeType, items: PlanItem[]): Promise<PriceBreakdown> {
    const lines = items.map((item) => {
      const base = priceOf(item.productCode);
      const childDiff = item.children.reduce((sum, child) => {
        const round = DEMO_COMBO.rounds.find((r) => String(r.id) === child.round);
        const choice = round?.choices.find((c) => c.code === child.code);
        return sum + (choice?.diffPriceCents ?? 0);
      }, 0);
      const subtotal = (base + childDiff) * item.quantity;
      return {
        productCode: item.productCode,
        productName: item.name,
        quantity: item.quantity,
        subtotalCents: subtotal,
        originalSubtotalCents: subtotal,
      };
    });

    const total = lines.reduce((s, l) => s + l.subtotalCents, 0);

    return {
      priceCents: total,
      originalPriceCents: total,
      discountCents: 0,
      lines,
      takeWayList: [
        { code: 'eat-in', title: '堂食', subtitle: '店内用餐' },
        { code: 'take-in-store', title: '外带', subtitle: '店内自提' },
      ],
      fetchedAt: new Date().toISOString(),
      source: 'demo',
    };
  }

  async createOrder(): Promise<CreateOrderResult> {
    // 演示模式绝不产生真实订单
    return {
      orderId: 'DEMO-ORDER-0001',
      payUrl: undefined,
      raw: { demo: true, note: '演示模式不会创建真实订单', beType: beTypeToOrderType(1) },
    };
  }
}
