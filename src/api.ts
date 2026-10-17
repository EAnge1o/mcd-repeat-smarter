/**
 * 前端 API 客户端。
 *
 * 所有请求都打到同源的 /api，由 vite 代理到本地服务端。
 * Token 与 MCP 原始响应永远不会出现在这里。
 */

import type {
  BeType,
  CandidatePlan,
  ComboDetail,
  Coupon,
  HistoryOrder,
  MenuProduct,
  ParsedIntent,
  Plan,
  PlanItem,
  PriceBreakdown,
  Store,
} from '../server/domain/types';

export type { BeType, CandidatePlan, ComboDetail, Coupon, HistoryOrder, MenuProduct, ParsedIntent, Plan, PlanItem, PriceBreakdown, Store };

export interface HealthInfo {
  mode: 'live' | 'demo';
  demoReason?: string;
  city: string;
  defaultStoreCode: string;
  beTypes: { value: number; label: string }[];
}

export interface ApiError {
  code: string;
  message: string;
  hint?: string;
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: ApiError,
  ) {
    super(detail.message);
    this.name = 'ApiRequestError';
  }
}

type Envelope<T> = { ok: true; data: T; source?: string; fetchedAt: string } | { ok: false; error: ApiError; fetchedAt: string };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiRequestError(0, {
      code: 'NETWORK',
      message: '连不上本地服务',
      hint: '确认 npm run dev 的 SERVER 进程还在运行。',
    });
  }

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiRequestError(res.status, {
      code: 'BAD_RESPONSE',
      message: `服务返回了无法解析的内容（HTTP ${res.status}）`,
    });
  }

  if (!body.ok) {
    throw new ApiRequestError(res.status, body.error);
  }
  return body.data;
}

const get = <T>(path: string) => request<T>(path);
const post = <T>(path: string, payload: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(payload) });
const patch = <T>(path: string, payload: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(payload) });
const del = <T>(path: string) => request<T>(path, { method: 'DELETE' });

export interface MatchedView {
  name: string;
  quantity: number;
  status: string;
  currentName?: string;
  notes: string[];
  children: {
    name: string;
    status: string;
    currentName?: string;
    reason: string;
    alternatives: { code: string; name: string; diffPrice?: string }[];
  }[];
}

export interface AdjustResult {
  intent: ParsedIntent;
  baseFrom: { kind: 'plan' | 'history'; planId?: string; name: string };
  store: { storeCode: string; storeName: string };
  beType: BeType;
  matched: MatchedView[];
  matchSummary: { exact: number; adjusted: number; unavailable: number; hasRisk: boolean };
  candidates: CandidatePlan[];
}

export interface PreviewResult {
  token: string;
  expiresAt: string;
  price: PriceBreakdown;
  priceChecks: string[];
  takeWayList: { code: string; title: string; subtitle: string }[];
  requiresExplicitConfirm: boolean;
}

export interface ConfirmResult {
  orderId?: string;
  payUrl?: string;
  mode: 'live' | 'demo';
  note: string;
  takeWayCode: string;
}

export const api = {
  health: () => get<HealthInfo>('/api/health'),
  history: () => get<{ orders: HistoryOrder[] }>('/api/history'),
  stores: (city: string, keyword: string, beType: BeType) =>
    get<{ stores: Store[] }>(`/api/stores?city=${encodeURIComponent(city)}&keyword=${encodeURIComponent(keyword)}&beType=${beType}`),
  menu: (storeCode: string, beType: BeType) => get<{ products: MenuProduct[]; orderType: number }>(`/api/menu?storeCode=${storeCode}&beType=${beType}`),
  combo: (code: string, storeCode: string, beType: BeType) => get<ComboDetail>(`/api/combo/${code}?storeCode=${storeCode}&beType=${beType}`),
  coupons: () => get<{ coupons: Coupon[] }>('/api/coupons'),

  plans: () => get<{ plans: Plan[] }>('/api/plans'),
  createPlan: (payload: Partial<Plan>) => post<{ plan: Plan }>('/api/plans', payload),
  updatePlan: (id: string, payload: Partial<Plan>) => patch<{ plan: Plan }>(`/api/plans/${id}`, payload),
  duplicatePlan: (id: string) => post<{ plan: Plan }>(`/api/plans/${id}/duplicate`, {}),
  deletePlan: (id: string) => del<{ removed: boolean }>(`/api/plans/${id}`),

  adjust: (payload: { message: string; basePlanId?: string; storeCode?: string; storeName?: string; beType?: BeType }) =>
    post<AdjustResult>('/api/adjust', payload),
  preview: (payload: { storeCode: string; beType: BeType; items: PlanItem[] }) => post<PreviewResult>('/api/order/preview', payload),
  confirm: (payload: { token: string; takeWayCode: string; confirmed: boolean; remark?: string }) =>
    post<ConfirmResult>('/api/order/confirm', payload),
};
