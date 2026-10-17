/**
 * 麦当劳 MCP 业务适配层。
 *
 * 职责：把 MCP 的原始返回结构归一化为领域模型，并集中处理所有「字段名/单位/类型不一致」的坑：
 * - calculate-price 的金额单位是「分」，而菜单里 currentPrice 是「元」的字符串。
 * - order-list 的 beType 是字符串，detail 的 rounds[].id 是数字。
 * - 套餐子项必须按 rounds 分组，才能拼出 roundList。
 */

import { McpClient, McpError } from './client.js';
import {
  beTypeToOrderType,
  type BeType,
  type ComboDetail,
  type Coupon,
  type HistoryOrder,
  type MenuProduct,
  type ModValue,
  type PlanItem,
  type PriceBreakdown,
  type Store,
} from '../domain/types.js';

interface McpEnvelope<T> {
  success?: boolean;
  code?: number;
  message?: string;
  traceId?: string;
  data: T;
}

/** 「元」字符串 → 「分」整数。MCP 的菜单价格带一位小数，先转分避免浮点误差。 */
export function yuanToCents(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** 已是「分」的整数（calculate-price 的返回） */
export function asCents(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** "+ ¥2.5" / "+¥0" / "- ¥1" → 分 */
export function parseDiffPrice(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/(-?)\s*¥?\s*([\d.]+)/);
  if (!match) return 0;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * Math.round(Number.parseFloat(match[2]) * 100);
}

function unwrap<T>(res: McpEnvelope<T>, tool: string): T {
  if (res && res.success === false) {
    throw new McpError(res.message || `${tool} 返回失败`, 'tool');
  }
  return res.data;
}

export interface CalcLine {
  productCode: string;
  productName: string;
  quantity: number;
  subtotalCents: number;
  originalSubtotalCents: number;
}

export class McdService {
  readonly mode = 'live' as const;

  constructor(private readonly client: McpClient) {}

  /** 门店搜索：searchType=2 按城市+关键词；searchType=1 收藏门店（可能为空）。 */
  async findStores(city: string, keyword: string, beType: BeType = 1): Promise<Store[]> {
    const raw = await this.client.callTool<McpEnvelope<unknown[]>>('query-nearby-stores', {
      beType,
      searchType: 2,
      city,
      keyword,
    });
    const list = unwrap(raw, 'query-nearby-stores') ?? [];
    return (list as Record<string, unknown>[]).map((s) => ({
      storeCode: String(s.storeCode ?? ''),
      storeName: String(s.storeName ?? ''),
      address: String(s.address ?? ''),
      distance: typeof s.distance === 'number' ? s.distance : undefined,
      beCode: s.beCode ? String(s.beCode) : undefined,
      businessStatus: typeof s.businessStatus === 'boolean' ? s.businessStatus : undefined,
      businessStartTime: s.businessStartTime ? String(s.businessStartTime) : undefined,
      businessEndTime: s.businessEndTime ? String(s.businessEndTime) : undefined,
      reservationTimeOptions: Array.isArray(s.reservationTimeOptions)
        ? (s.reservationTimeOptions as Record<string, unknown>[]).map((o) => ({
            date: String(o.date ?? ''),
            today: Boolean(o.today),
            reservationOptionText: String(o.reservationOptionText ?? ''),
          }))
        : undefined,
    }));
  }

  /** 当前门店在售菜单（含价格与图片）。 */
  async getMenu(storeCode: string, beType: BeType = 1): Promise<{ products: MenuProduct[]; orderType: number }> {
    const orderType = beTypeToOrderType(beType);
    const raw = await this.client.callTool<
      McpEnvelope<{
        categories?: { name: string; meals?: { code: string; tags?: string[] }[] }[];
        meals?: Record<string, { name?: string; image?: string; currentPrice?: string; originalPrice?: string }>;
      }>
    >('query-meals', { storeCode, orderType, beType });

    const data = unwrap(raw, 'query-meals') ?? {};
    const meals = data.meals ?? {};
    const categories = data.categories ?? [];

    // 建立 code → 分类/标签 索引
    const meta = new Map<string, { categories: string[]; tags: string[] }>();
    for (const cat of categories) {
      for (const meal of cat.meals ?? []) {
        const entry = meta.get(meal.code) ?? { categories: [], tags: [] };
        if (!entry.categories.includes(cat.name)) entry.categories.push(cat.name);
        for (const tag of meal.tags ?? []) {
          if (!entry.tags.includes(tag)) entry.tags.push(tag);
        }
        meta.set(meal.code, entry);
      }
    }

    const products: MenuProduct[] = Object.entries(meals).map(([code, v]) => ({
      code,
      name: String(v.name ?? ''),
      priceCents: yuanToCents(v.currentPrice),
      originalPriceCents: yuanToCents(v.originalPrice ?? v.currentPrice),
      image: v.image,
      tags: meta.get(code)?.tags ?? [],
      categories: meta.get(code)?.categories ?? [],
    }));

    return { products, orderType };
  }

  /** 套餐详情：轮次 + 可选子项 + 特制项。 */
  async getComboDetail(storeCode: string, code: string, beType: BeType = 1): Promise<ComboDetail> {
    const orderType = beTypeToOrderType(beType);
    const raw = await this.client.callTool<
      McpEnvelope<{
        code?: string;
        name?: string;
        image?: string;
        supportModify?: boolean;
        rounds?: Record<string, unknown>[];
      }>
    >('query-meal-detail', { storeCode, orderType, beType, code });

    const data = unwrap(raw, 'query-meal-detail');
    const rounds = (data.rounds ?? []) as Record<string, unknown>[];

    return {
      code: String(data.code ?? code),
      name: String(data.name ?? ''),
      image: data.image,
      supportModify: Boolean(data.supportModify),
      rounds: rounds.map((r) => ({
        id: Number(r.id ?? 0),
        name: String(r.name ?? ''),
        quantity: Number(r.quantity ?? 1),
        minQuantity: Number(r.minQuantity ?? 1),
        maxQuantity: Number(r.maxQuantity ?? 1),
        choices: ((r.choices ?? []) as Record<string, unknown>[]).map((c) => ({
          code: String(c.code ?? ''),
          name: String(c.name ?? ''),
          isDefault: Number(c.isDefault ?? 0) === 1,
          diffPrice: String(c.diffPrice ?? ''),
          diffPriceCents: parseDiffPrice(String(c.diffPrice ?? '')),
          supportModify: Boolean(c.supportModify),
          modification: extractModValues(c.modification),
        })),
      })),
    };
  }

  /** 历史订单（MCP 真实返回）。没有历史订单时返回空数组。 */
  async getHistory(): Promise<HistoryOrder[]> {
    const raw = await this.client.callTool<McpEnvelope<{ list?: Record<string, unknown>[] }>>('order-list', {});
    const data = unwrap(raw, 'order-list') ?? {};
    const list = data.list ?? [];

    return list.map((o) => {
      const products = (o.orderProductList ?? []) as Record<string, unknown>[];
      const items: PlanItem[] = products.map((p) => {
        const combo = (p.comboItemList ?? []) as Record<string, unknown>[];
        return {
          productCode: String(p.productCode ?? ''),
          name: String(p.productName ?? ''),
          quantity: Number(p.quantity ?? 1),
          children: combo.map((c) => ({
            code: String(c.productCode ?? ''),
            name: String(c.name ?? ''),
            quantity: Number(c.quantity ?? 1),
            // 历史订单不返回轮次归属，此处留空，匹配阶段再按当前套餐定义推断
          })),
          isCombo: combo.length > 0,
        };
      });

      return {
        orderId: String(o.orderId ?? ''),
        createTime: String(o.createTime ?? ''),
        storeCode: String(o.storeCode ?? ''),
        storeName: String(o.storeName ?? ''),
        beType: (Number(o.beType ?? 1) as BeType) || 1,
        orderStatus: String(o.orderStatus ?? ''),
        paidYuan: o.realTotalAmount === undefined || o.realTotalAmount === null ? null : String(o.realTotalAmount),
        items,
      };
    });
  }

  /** 真实核价。金额单位：分。 */
  async calcPrice(storeCode: string, beType: BeType, items: PlanItem[]): Promise<PriceBreakdown> {
    const orderType = beTypeToOrderType(beType);
    const payload = items.map((item) => {
      const roundMap = new Map<string, { code: string; quantity: number }[]>();
      for (const child of item.children) {
        if (!child.round) continue;
        const bucket = roundMap.get(child.round) ?? [];
        bucket.push({ code: child.code, quantity: child.quantity });
        roundMap.set(child.round, bucket);
      }
      const roundList = [...roundMap.entries()].map(([round, comboItemList]) => ({ round, comboItemList }));
      return {
        productCode: item.productCode,
        quantity: item.quantity,
        ...(roundList.length > 0 ? { roundList } : {}),
      };
    });

    const raw = await this.client.callTool<
      McpEnvelope<{
        price?: number;
        originalPrice?: number;
        discount?: number;
        productList?: Record<string, unknown>[];
        takeWayList?: { code: string; title: string; subtitle: string }[];
      }>
    >('calculate-price', { storeCode, orderType, beType, items: payload });

    const data = unwrap(raw, 'calculate-price') ?? {};
    const lines = (data.productList ?? []).map((p) => ({
      productCode: String(p.productCode ?? ''),
      productName: String(p.productName ?? ''),
      quantity: Number(p.quantity ?? 1),
      subtotalCents: asCents(p.subtotal),
      originalSubtotalCents: asCents(p.originalSubtotal),
    }));

    return {
      priceCents: asCents(data.price),
      originalPriceCents: asCents(data.originalPrice ?? data.price),
      discountCents: asCents(data.discount),
      lines,
      takeWayList: (data.takeWayList ?? []).map((t) => ({ code: t.code, title: t.title, subtitle: t.subtitle })),
      traceId: raw.traceId,
      fetchedAt: new Date().toISOString(),
      source: 'mcp',
    };
  }

  /** 我的优惠券（账户维度）。 */
  async getMyCoupons(): Promise<Coupon[]> {
    const raw = await this.client.callTool<McpEnvelope<{ coupons?: Record<string, unknown>[] }>>('query-my-coupons', {});
    const data = unwrap(raw, 'query-my-coupons') ?? {};
    return (data.coupons ?? []).map((c) => ({
      id: String(c.id ?? ''),
      code: String(c.code ?? ''),
      title: String(c.title ?? ''),
      subtitle: c.subtitle ? String(c.subtitle) : undefined,
      image: c.image ? String(c.image) : undefined,
    }));
  }

  /**
   * 创建订单（有副作用）。
   * 只有调用方已经拿到用户的显式确认后，才允许调用此方法。
   */
  async createOrder(params: {
    storeCode: string;
    beType: BeType;
    items: PlanItem[];
    takeWayCode: string;
    remark?: string;
  }): Promise<{ orderId?: string; payUrl?: string; raw: unknown }> {
    const orderType = beTypeToOrderType(params.beType);
    const payload = params.items.map((item) => {
      const roundMap = new Map<string, { code: string; quantity: number }[]>();
      for (const child of item.children) {
        if (!child.round) continue;
        const bucket = roundMap.get(child.round) ?? [];
        bucket.push({ code: child.code, quantity: child.quantity });
        roundMap.set(child.round, bucket);
      }
      const roundList = [...roundMap.entries()].map(([round, comboItemList]) => ({ round, comboItemList }));
      return {
        productCode: item.productCode,
        quantity: item.quantity,
        ...(roundList.length > 0 ? { roundList } : {}),
      };
    });

    const raw = await this.client.callTool<McpEnvelope<Record<string, unknown>>>('create-order', {
      storeCode: params.storeCode,
      orderType,
      beType: params.beType,
      takeWayCode: params.takeWayCode,
      items: payload,
      ...(params.beType === 2 && params.remark ? { remark: params.remark.slice(0, 50) } : {}),
    });

    const data = unwrap(raw, 'create-order') ?? {};
    return {
      orderId: data.orderId ? String(data.orderId) : undefined,
      payUrl: data.payUrl ? String(data.payUrl) : data.payLink ? String(data.payLink) : undefined,
      raw: data,
    };
  }
}

/** 从 MCP 的 modification 定义中提取可用的特制值（含 selectedKey/unselectedKey）。 */
function extractModValues(modification: unknown): ModValue[] | undefined {
  if (!modification || typeof modification !== 'object') return undefined;
  const groups = (modification as { items?: { values?: Record<string, unknown>[] }[] }).items;
  if (!Array.isArray(groups)) return undefined;

  const out: ModValue[] = [];
  for (const group of groups) {
    for (const v of group.values ?? []) {
      out.push({
        code: String(v.code ?? ''),
        key: String(v.selectedKey ?? v.unselectedKey ?? ''),
        quantity: Number(v.selectedQuantity ?? 1),
        name: String(v.name ?? ''),
      });
    }
  }
  return out.length > 0 ? out : undefined;
}
