/**
 * API 路由层：把 MCP 网关、领域逻辑和持久化编排成稳定的 HTTP 接口。
 *
 * 关键设计：
 * - 前端永远拿不到 Token，也拿不到 MCP 原始响应。
 * - 有副作用的操作（下单）走「预览令牌」两段式：必须先 preview 拿到 token，再 confirm。
 *   token 绑定商品、门店、金额，5 分钟过期，且 confirm 必须显式带 confirmed=true。
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { McdGateway } from '../mcp/gateway.js';
import { McpError } from '../mcp/client.js';
import { planStore } from '../store/planStore.js';
import { parseIntent } from '../domain/intent.js';
import { matchPlan, summarizeMatch } from '../domain/matcher.js';
import { buildCandidates, markBudget, type PlanRequest } from '../domain/planner.js';
import { verifyBreakdown } from '../domain/pricing.js';
import {
  BE_TYPE_LABEL,
  type BeType,
  type ComboDetail,
  type Plan,
  type PlanItem,
} from '../domain/types.js';
import { config, gatewayStatus } from '../config.js';

interface PreviewRecord {
  token: string;
  storeCode: string;
  beType: BeType;
  items: PlanItem[];
  priceCents: number;
  takeWayList: { code: string; title: string; subtitle: string }[];
  expiresAt: number;
  mode: 'live' | 'demo';
}

const PREVIEW_TTL_MS = 5 * 60 * 1000;
const previews = new Map<string, PreviewRecord>();

function nowIso(): string {
  return new Date().toISOString();
}

function ok<T>(res: Response, data: T, extra: Record<string, unknown> = {}): void {
  res.json({ ok: true, data, fetchedAt: nowIso(), ...extra });
}

function fail(res: Response, status: number, code: string, message: string, hint?: string): void {
  res.status(status).json({ ok: false, error: { code, message, hint }, fetchedAt: nowIso() });
}

function parseBeType(input: unknown): BeType {
  const n = Number(input ?? 1);
  return ([1, 2, 5, 6] as BeType[]).includes(n as BeType) ? (n as BeType) : 1;
}

/** 把套餐商品的空子项补齐为该套餐的默认选项（否则 MCP 核价会返回 0）。 */
function ensureRounds(items: PlanItem[], combos: Map<string, ComboDetail>): PlanItem[] {
  return items.map((item) => {
    const combo = combos.get(item.productCode);
    if (!combo || combo.rounds.length === 0) return item;
    if (item.children.length > 0) return { ...item, isCombo: true };
    return {
      ...item,
      isCombo: true,
      children: combo.rounds.map((r) => {
        const pick = r.choices.find((c) => c.isDefault) ?? r.choices[0];
        return {
          code: pick.code,
          name: pick.name,
          quantity: r.quantity || 1,
          round: String(r.id),
          roundName: r.name,
        };
      }),
    };
  });
}

/** 收集需要拉取套餐详情的编码：方案里的套餐 + 菜单里同名匹配到的套餐。 */
function collectComboCodes(items: PlanItem[], candidates: string[]): string[] {
  const set = new Set<string>(candidates);
  for (const item of items) {
    if (item.isCombo || item.children.length > 0) set.add(item.productCode);
  }
  return [...set].filter(Boolean);
}

async function loadCombos(gateway: McdGateway, storeCode: string, beType: BeType, codes: string[]): Promise<Map<string, ComboDetail>> {
  const map = new Map<string, ComboDetail>();
  // 控制并发，避免触发 600 次/分钟限流
  const batchSize = 4;
  for (let i = 0; i < codes.length; i += batchSize) {
    const batch = codes.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (code) => {
        try {
          return [code, await gateway.getComboDetail(storeCode, code, beType)] as const;
        } catch {
          return undefined;
        }
      }),
    );
    for (const r of results) {
      if (r && r[1].rounds.length > 0) map.set(r[0], r[1]);
    }
  }
  return map;
}

/**
 * 生成「压到预算内」的候选：只做确定性降价，不改变用户明确要求保留的主体。
 * 策略：把套餐里带加价的子项换成同轮次零差价项；仍超预算则提示无法满足。
 */
function buildBudgetFit(items: PlanItem[], combos: Map<string, ComboDetail>): { items: PlanItem[]; notes: string[] } {
  const next: PlanItem[] = items.map((i) => ({ ...i, children: i.children.map((c) => ({ ...c })) }));
  const notes: string[] = [];

  for (const item of next) {
    const combo = combos.get(item.productCode);
    if (!combo) continue;
    item.children = item.children.map((child) => {
      const round = combo.rounds.find((r) => String(r.id) === child.round);
      if (!round) return child;
      const current = round.choices.find((c) => c.code === child.code);
      if (!current || current.diffPriceCents <= 0) return child;
      const cheaper = round.choices
        .filter((c) => c.diffPriceCents < current.diffPriceCents)
        .sort((a, b) => a.diffPriceCents - b.diffPriceCents)[0];
      if (!cheaper) return child;
      notes.push(`${round.name}：${child.name} → ${cheaper.name}（省 ¥${((current.diffPriceCents - cheaper.diffPriceCents) / 100).toFixed(1)}）`);
      return { ...child, code: cheaper.code, name: cheaper.name };
    });
  }

  return { items: next, notes };
}

export function createApiRouter(gateway: McdGateway): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    ok(res, { ...gatewayStatus(gateway), beTypes: Object.entries(BE_TYPE_LABEL).map(([k, v]) => ({ value: Number(k), label: v })) });
  });

  // ---------- MCP 只读数据 ----------

  router.get('/history', async (_req, res, next) => {
    try {
      const orders = await gateway.getHistory();
      ok(res, { orders }, { source: gateway.mode });
    } catch (err) {
      next(err);
    }
  });

  router.get('/stores', async (req, res, next) => {
    try {
      const city = String(req.query.city ?? config.city);
      const keyword = String(req.query.keyword ?? '');
      const beType = parseBeType(req.query.beType);
      if (!keyword.trim()) {
        fail(res, 400, 'KEYWORD_REQUIRED', '请填写门店关键词（例如商圈或地标名）', 'MCP 的门店搜索需要城市 + 关键词。');
        return;
      }
      const stores = await gateway.findStores(city, keyword, beType);
      ok(res, { stores }, { source: gateway.mode });
    } catch (err) {
      next(err);
    }
  });

  router.get('/menu', async (req, res, next) => {
    try {
      const storeCode = String(req.query.storeCode ?? '');
      const beType = parseBeType(req.query.beType);
      if (!storeCode) {
        fail(res, 400, 'STORE_REQUIRED', '请先选择门店');
        return;
      }
      const menu = await gateway.getMenu(storeCode, beType);
      ok(res, menu, { source: gateway.mode });
    } catch (err) {
      next(err);
    }
  });

  router.get('/combo/:code', async (req, res, next) => {
    try {
      const storeCode = String(req.query.storeCode ?? '');
      const beType = parseBeType(req.query.beType);
      if (!storeCode) {
        fail(res, 400, 'STORE_REQUIRED', '请先选择门店');
        return;
      }
      const detail = await gateway.getComboDetail(storeCode, req.params.code, beType);
      ok(res, detail, { source: gateway.mode });
    } catch (err) {
      next(err);
    }
  });

  router.get('/coupons', async (_req, res, next) => {
    try {
      const coupons = await gateway.getMyCoupons();
      ok(res, { coupons }, { source: gateway.mode });
    } catch (err) {
      next(err);
    }
  });

  // ---------- 常用方案 CRUD ----------

  router.get('/plans', async (_req, res, next) => {
    try {
      ok(res, { plans: await planStore.list() }, { source: 'user' });
    } catch (err) {
      next(err);
    }
  });

  router.get('/plans/:id', async (req, res, next) => {
    try {
      const plan = await planStore.get(req.params.id);
      if (!plan) {
        fail(res, 404, 'PLAN_NOT_FOUND', '这个方案不存在，可能已被删除');
        return;
      }
      ok(res, { plan }, { source: 'user' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/plans', async (req, res, next) => {
    try {
      const body = req.body as Partial<Plan>;
      if (!body || !Array.isArray(body.items) || body.items.length === 0) {
        fail(res, 400, 'PLAN_EMPTY', '方案里没有商品，无法保存');
        return;
      }
      const plan = await planStore.create({
        name: String(body.name ?? '我的方案'),
        storeCode: String(body.storeCode ?? ''),
        storeName: String(body.storeName ?? ''),
        beType: parseBeType(body.beType),
        items: body.items,
        source: 'user',
        tag: body.tag,
        note: body.note,
      });
      ok(res, { plan }, { source: 'user' });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/plans/:id', async (req, res, next) => {
    try {
      const body = req.body as Partial<Plan>;
      const plan = await planStore.update(req.params.id, {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.items !== undefined ? { items: body.items } : {}),
        ...(body.tag !== undefined ? { tag: String(body.tag) } : {}),
        ...(body.note !== undefined ? { note: String(body.note) } : {}),
      });
      if (!plan) {
        fail(res, 404, 'PLAN_NOT_FOUND', '这个方案不存在');
        return;
      }
      ok(res, { plan }, { source: 'user' });
    } catch (err) {
      next(err);
    }
  });

  router.post('/plans/:id/duplicate', async (req, res, next) => {
    try {
      const plan = await planStore.duplicate(req.params.id);
      if (!plan) {
        fail(res, 404, 'PLAN_NOT_FOUND', '这个方案不存在');
        return;
      }
      ok(res, { plan }, { source: 'user' });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/plans/:id', async (req, res, next) => {
    try {
      const removed = await planStore.remove(req.params.id);
      if (!removed) {
        fail(res, 404, 'PLAN_NOT_FOUND', '这个方案不存在');
        return;
      }
      ok(res, { removed: true }, { source: 'user' });
    } catch (err) {
      next(err);
    }
  });

  // ---------- 核心：增量调整 ----------

  router.post('/adjust', async (req, res, next) => {
    try {
      const body = req.body as {
        message?: string;
        basePlanId?: string;
        storeCode?: string;
        storeName?: string;
        beType?: BeType;
      };

      const message = String(body.message ?? '').trim();
      if (!message) {
        fail(res, 400, 'MESSAGE_REQUIRED', '说一句你想怎么改，例如「还是上次那份，不要薯饼」');
        return;
      }

      const beType = parseBeType(body.beType);
      let storeCode = String(body.storeCode ?? config.defaultStoreCode ?? '');
      let storeName = String(body.storeName ?? '');
      let baseItems: PlanItem[] | undefined;
      let basePlan: Plan | undefined;

      if (body.basePlanId) {
        basePlan = await planStore.get(body.basePlanId);
        if (!basePlan) {
          fail(res, 404, 'PLAN_NOT_FOUND', '找不到这个常用方案');
          return;
        }
        baseItems = basePlan.items;
        storeCode = storeCode || basePlan.storeCode;
        storeName = storeName || basePlan.storeName;
      } else {
        // 没指定方案时，用最近一单历史订单作为「上次那份」
        const history = await gateway.getHistory();
        if (history.length === 0) {
          fail(
            res,
            409,
            'NO_BASE',
            '还没有可以参照的历史订单，也没有保存过常用方案',
            '先在下方手动挑一份存成「老样子」，之后就能一句话改。',
          );
          return;
        }
        const latest = [...history].sort((a, b) => b.createTime.localeCompare(a.createTime))[0];
        baseItems = latest.items;
        storeCode = storeCode || latest.storeCode;
        storeName = storeName || latest.storeName;
      }

      if (!storeCode) {
        fail(res, 400, 'STORE_REQUIRED', '还没有确定门店', '请先搜索并选择一家门店。');
        return;
      }

      const intent = parseIntent(message);
      const menu = await gateway.getMenu(storeCode, beType);
      const menuProducts = menu.products;

      // 先做一次粗匹配，拿到「当前有效编码」，才能正确拉套餐详情
      const roughCombos = await loadCombos(gateway, storeCode, beType, collectComboCodes(baseItems, []));
      const roughMatched = matchPlan(baseItems, { menu: menuProducts, combos: roughCombos });

      const currentItems = roughMatched.map((m) => m.current).filter((x): x is PlanItem => Boolean(x));
      const combos = await loadCombos(gateway, storeCode, beType, collectComboCodes(currentItems, []));

      const matched = matchPlan(baseItems, { menu: menuProducts, combos });
      const baseForPlanner = matched.map((m) => m.current).filter((x): x is PlanItem => Boolean(x));

      const planRequest: PlanRequest = {
        baseItems: ensureRounds(baseForPlanner, combos),
        intent,
        menu: menuProducts,
        combos,
      };

      let candidates = buildCandidates(planRequest).map((c) => ({ ...c, items: ensureRounds(c.items, combos) }));

      /*
       * 历史订单里的名字可能已经改过（随心配1+1 → 人气经典随心配）。
       * 这类重命名不算「按你说的改」，但如果候选还叫「原样不变」，
       * 界面上就会出现「原样不变 + 换了商品」的自相矛盾，所以这里把话说全。
       */
      if (matched.some((m) => m.status === 'renamed')) {
        candidates = candidates.map((c) =>
          c.strategy === 'minimal' && c.label === '原样不变' ? { ...c, label: '照旧 · 按当前菜单对齐' } : c,
        );
      }

      // 真实核价（逐候选调用官方 calculate-price）
      const priced = await Promise.all(
        candidates.map(async (c) => {
          try {
            const price = await gateway.calcPrice(storeCode, beType, c.items);
            const check = verifyBreakdown(price, c.items);
            return {
              ...markBudget({ ...c, price }, intent.budgetCents ?? null),
              priceChecks: check.warnings,
            };
          } catch (err) {
            const message = err instanceof McpError ? err.message : '核价失败';
            return { ...c, priceChecks: [message] };
          }
        }),
      );
      candidates = priced;

      // 若全部超预算，追加一个「压到预算内」的候选（仍以真实核价为准）
      const budget = intent.budgetCents ?? null;
      const anyWithin = candidates.some((c) => c.withinBudget === true);
      if (budget !== null && !anyWithin) {
        const fit = buildBudgetFit(planRequest.baseItems, combos);
        if (fit.notes.length > 0) {
          const fitItems = ensureRounds(fit.items, combos);
          try {
            const price = await gateway.calcPrice(storeCode, beType, fitItems);
            const check = verifyBreakdown(price, fitItems);
            const fitCandidate = markBudget(
              {
                id: 'budget-fit',
                label: '压到预算内',
                strategy: 'budget-fit' as const,
                items: fitItems,
                changes: [
                  ...fit.notes.map((n) => ({ type: 'replaced' as const, target: n, detail: n })),
                ],
                price,
                withinBudget: null,
                explain: ['在不改变你主体选择的前提下，把加价项换成同轮次零差价项', ...fit.notes],
              },
              budget,
            );
            candidates.push({ ...fitCandidate, priceChecks: check.warnings });
          } catch {
            // 压价候选失败不影响主流程
          }
        }
      }

      const summary = summarizeMatch(matched);

      ok(
        res,
        {
          intent,
          baseFrom: basePlan
            ? { kind: 'plan' as const, planId: basePlan.id, name: basePlan.name }
            : { kind: 'history' as const, name: storeName },
          store: { storeCode, storeName },
          beType,
          matched: matched.map((m) => ({
            name: m.original.name,
            quantity: m.original.quantity,
            status: m.status,
            currentName: m.current?.name,
            notes: m.notes,
            children: m.children.map((c) => ({
              name: c.original.name,
              status: c.status,
              currentName: c.current?.name,
              reason: c.reason,
              alternatives: c.alternatives,
            })),
          })),
          matchSummary: summary,
          candidates,
        },
        { source: gateway.mode },
      );
    } catch (err) {
      next(err);
    }
  });

  // ---------- 下单前预览（产生令牌，不产生副作用） ----------

  router.post('/order/preview', async (req, res, next) => {
    try {
      const body = req.body as { storeCode?: string; beType?: BeType; items?: PlanItem[] };
      const storeCode = String(body.storeCode ?? '');
      const beType = parseBeType(body.beType);
      const items = Array.isArray(body.items) ? body.items : [];

      if (!storeCode || items.length === 0) {
        fail(res, 400, 'INVALID_PREVIEW', '缺少门店或商品，无法生成订单预览');
        return;
      }

      const price = await gateway.calcPrice(storeCode, beType, items);
      const check = verifyBreakdown(price, items);

      const token = randomUUID();
      const record: PreviewRecord = {
        token,
        storeCode,
        beType,
        items,
        priceCents: price.priceCents,
        takeWayList: price.takeWayList,
        expiresAt: Date.now() + PREVIEW_TTL_MS,
        mode: gateway.mode,
      };
      previews.set(token, record);

      // 清理过期令牌
      for (const [key, value] of previews) {
        if (value.expiresAt < Date.now()) previews.delete(key);
      }

      ok(
        res,
        {
          token,
          expiresAt: new Date(record.expiresAt).toISOString(),
          price,
          priceChecks: check.warnings,
          takeWayList: price.takeWayList,
          requiresExplicitConfirm: true,
        },
        { source: gateway.mode, traceId: price.traceId },
      );
    } catch (err) {
      next(err);
    }
  });

  // ---------- 下单（有副作用，必须显式确认） ----------

  router.post('/order/confirm', async (req, res, next) => {
    try {
      const body = req.body as { token?: string; takeWayCode?: string; confirmed?: boolean; remark?: string };

      if (!body.token) {
        fail(res, 400, 'TOKEN_REQUIRED', '缺少订单预览令牌，请先生成订单预览');
        return;
      }
      if (body.confirmed !== true) {
        fail(res, 428, 'CONFIRM_REQUIRED', '下单需要显式确认', '请勾选确认后再提交，系统不会代替你做决定。');
        return;
      }

      const record = previews.get(body.token);
      if (!record) {
        fail(res, 410, 'PREVIEW_EXPIRED', '订单预览已失效，请重新生成');
        return;
      }
      if (record.expiresAt < Date.now()) {
        previews.delete(body.token);
        fail(res, 410, 'PREVIEW_EXPIRED', '订单预览已过期（有效期 5 分钟），请重新生成');
        return;
      }

      const takeWayCode = body.takeWayCode || record.takeWayList[0]?.code;
      if (!takeWayCode || !record.takeWayList.some((t) => t.code === takeWayCode)) {
        fail(res, 400, 'INVALID_TAKEWAY', '取餐方式无效，请重新选择');
        return;
      }

      const result = await gateway.createOrder({
        storeCode: record.storeCode,
        beType: record.beType,
        items: record.items,
        takeWayCode,
        remark: body.remark,
      });

      // 令牌一次性使用
      previews.delete(body.token);

      ok(
        res,
        {
          orderId: result.orderId,
          payUrl: result.payUrl,
          mode: gateway.mode,
          note: gateway.mode === 'demo' ? '演示模式：没有创建真实订单' : '订单已提交，请按返回的链接完成支付',
          takeWayCode,
        },
        { source: gateway.mode },
      );
    } catch (err) {
      next(err);
    }
  });

  return router;
}

/** 统一错误处理：把 McpError 翻译成用户能照做的下一步。 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (res.headersSent) return;

  if (err instanceof McpError) {
    const statusMap: Record<McpError['kind'], number> = {
      auth: 401,
      rate: 429,
      network: 502,
      timeout: 504,
      tool: 502,
      protocol: 502,
      config: 500,
    };
    fail(res, statusMap[err.kind] ?? 500, `MCP_${err.kind.toUpperCase()}`, err.message, err.hint);
    return;
  }

  const message = err instanceof Error ? err.message : '未知错误';
  // 不把堆栈或敏感信息回传
  fail(res, 500, 'INTERNAL', '服务内部出错', message.slice(0, 200));
}
