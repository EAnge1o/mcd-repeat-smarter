/**
 * MCP 网关接口。
 *
 * 真实实现（McdService）与演示实现（DemoService）都实现这一接口，
 * 上层业务代码完全不感知数据来自哪里，只有 UI 通过 source 字段区分。
 *
 * 这是「演示数据绝不冒充真实数据」的工程保障：
 * 演示实现返回的每个 PriceBreakdown / Store 都带 source='demo'。
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

export interface CreateOrderResult {
  orderId?: string;
  payUrl?: string;
  raw: unknown;
}

export interface McdGateway {
  readonly mode: 'live' | 'demo';

  findStores(city: string, keyword: string, beType?: BeType): Promise<Store[]>;
  getMenu(storeCode: string, beType?: BeType): Promise<{ products: MenuProduct[]; orderType: number }>;
  getComboDetail(storeCode: string, code: string, beType?: BeType): Promise<ComboDetail>;
  getHistory(): Promise<HistoryOrder[]>;
  calcPrice(storeCode: string, beType: BeType, items: PlanItem[]): Promise<PriceBreakdown>;
  getMyCoupons(): Promise<Coupon[]>;
  createOrder(params: {
    storeCode: string;
    beType: BeType;
    items: PlanItem[];
    takeWayCode: string;
    remark?: string;
  }): Promise<CreateOrderResult>;
}
