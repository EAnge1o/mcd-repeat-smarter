/**
 * 候选方案生成器。
 *
 * 核心约束（产品差异化的关键）：
 * 1. 默认保留原方案全部内容，只修改用户明确提到的项。绝不「顺手重新推荐一遍」。
 * 2. 套餐子项被删除后，必须补位，否则该轮次不完整、MCP 核价会失败。
 * 3. 预算只作为硬约束检查，不偷偷放宽；无法满足时如实说明。
 * 4. 本模块是纯函数，不调用网络。价格由外部通过 calculate-price 注入。
 */

import type {
  AppliedChange,
  CandidatePlan,
  ComboDetail,
  MenuProduct,
  ParsedIntent,
  PlanChild,
  PlanItem,
} from './types.js';
import { findBestProduct, inferRound, nameSimilarity, normalizeName } from './matcher.js';

export interface PlanRequest {
  baseItems: PlanItem[];
  intent: ParsedIntent;
  menu: MenuProduct[];
  combos: Map<string, ComboDetail>;
}

interface Target {
  itemIndex: number;
  childIndex?: number;
}

/** 名称得分：同时考虑当前名与历史别名，避免商品换码后用户的旧称失效。 */
function bestNameScore(target: string, name: string, aliasNames?: string[]): number {
  let best = nameSimilarity(target, name);
  for (const alias of aliasNames ?? []) {
    const s = nameSimilarity(target, alias);
    if (s > best) best = s;
  }
  return best;
}

/** 在方案中定位用户口中的目标（可以是整项，也可以是套餐子项）。 */
export function locateTarget(target: string, items: PlanItem[]): Target | undefined {
  let best: { t: Target; score: number } | undefined;

  items.forEach((item, itemIndex) => {
    const itemScore = bestNameScore(target, item.name, item.aliasNames);
    if (itemScore >= 0.45 && (!best || itemScore > best.score)) {
      best = { t: { itemIndex }, score: itemScore };
    }
    item.children.forEach((child, childIndex) => {
      const childScore = bestNameScore(target, child.name, child.aliasNames);
      if (childScore >= 0.45 && (!best || childScore > best.score)) {
        best = { t: { itemIndex, childIndex }, score: childScore };
      }
    });
  });

  return best?.t;
}

function cloneItems(items: PlanItem[]): PlanItem[] {
  return items.map((i) => ({ ...i, children: i.children.map((c) => ({ ...c })) }));
}

/** 找到某个子项所在轮次的定义。 */
function roundOf(item: PlanItem, child: PlanChild, combos: Map<string, ComboDetail>) {
  const combo = combos.get(item.productCode);
  if (!combo) return undefined;
  const roundId = child.round ?? inferRound(child.code, 0, combo).round;
  const round = roundId ? combo.rounds.find((r) => String(r.id) === roundId) : undefined;
  return round ? { combo, round } : undefined;
}

/**
 * 子项被删除后补位：优先用该轮次默认项，其次用第一个不同于被删项的选择。
 * 这是避免「删了薯饼导致套餐不完整、核价失败」的关键。
 */
function refillRound(item: PlanItem, removed: PlanChild, combos: Map<string, ComboDetail>, menu: MenuProduct[]): PlanChild | undefined {
  const found = roundOf(item, removed, combos);
  if (!found) return undefined;
  const { round } = found;

  if (round.minQuantity <= 0) return undefined;

  const fallback = round.choices.find((c) => c.isDefault && c.code !== removed.code) ?? round.choices.find((c) => c.code !== removed.code);
  if (!fallback) return undefined;

  const menuHit = menu.find((m) => m.code === fallback.code);
  return {
    code: fallback.code,
    name: fallback.name || menuHit?.name || fallback.code,
    quantity: 1,
    round: String(round.id),
    roundName: round.name,
  };
}

/** 替换子项：在目标所在轮次内按名称找 replacement。 */
function replaceChildInRound(
  item: PlanItem,
  child: PlanChild,
  replacement: string | undefined,
  combos: Map<string, ComboDetail>,
  menu: MenuProduct[],
): { child?: PlanChild; change: AppliedChange } {
  const found = roundOf(item, child, combos);
  if (!found) {
    return {
      change: {
        type: 'unavailable',
        target: child.name,
        detail: '该项不是套餐子项，无法在套餐内替换',
      },
    };
  }
  const { round } = found;

  // 用户指定了替换目标 → 在轮次内按名称匹配；没指定 → 取推荐替代
  let chosen: { code: string; name: string } | undefined;
  if (replacement) {
    let bestScore = 0;
    for (const c of round.choices) {
      const score = nameSimilarity(replacement, c.name);
      if (score > bestScore) {
        bestScore = score;
        chosen = c;
      }
    }
    if (bestScore < 0.35) chosen = undefined;
  }

  if (!chosen) {
    // 开放式替换：优先零差价、且名称与该轮最不雷同的项，保证「换个东西」真的换了
    const pool = round.choices.filter((c) => c.code !== child.code);
    const sameKind = pool.filter((c) => normalizeName(c.name).slice(-1) === normalizeName(child.name).slice(-1));
    chosen =
      sameKind.find((c) => c.diffPriceCents === 0 && c.isDefault) ??
      sameKind.find((c) => c.diffPriceCents === 0) ??
      pool.find((c) => c.diffPriceCents === 0) ??
      pool[0];
  }

  if (!chosen) {
    return { change: { type: 'unavailable', target: child.name, detail: '该轮次没有可替换的选项' } };
  }

  const menuHit = menu.find((m) => m.code === chosen.code);
  const next: PlanChild = {
    code: chosen.code,
    name: chosen.name || menuHit?.name || chosen.code,
    quantity: child.quantity,
    round: String(round.id),
    roundName: round.name,
  };

  return {
    child: next,
    change: {
      type: 'replaced',
      target: child.name,
      detail: `${round.name}：${child.name} → ${next.name}`,
      before: child.name,
      after: next.name,
    },
  };
}

/** 应用一次意图到 items，返回新 items 与变更记录。 */
export function applyIntent(req: PlanRequest, items: PlanItem[]): { items: PlanItem[]; changes: AppliedChange[] } {
  let next = cloneItems(items);
  const changes: AppliedChange[] = [];

  for (const change of req.intent.changes) {
    if (change.type === 'budget' || change.type === 'keep') continue;
    if (change.type === 'preference') {
      changes.push({
        type: 'preference',
        target: change.preference ?? '',
        detail: `按「${change.preference}」挑了同轮次里符合的选项`,
      });
      continue;
    }

    // 新增商品：不依赖「原方案里是否存在」，必须在定位步骤之前处理，
    // 否则用户说「加一份麦乐鸡」会因为原方案里没有麦乐鸡而被当成无法落实。
    if (change.type === 'add' && change.target) {
      const product = findBestProduct(change.target, req.menu, 0.4);
      if (!product) {
        changes.push({ type: 'unavailable', target: change.target, detail: `菜单里没找到「${change.target}」` });
        continue;
      }
      const exists = next.find((i) => i.productCode === product.code);
      if (exists) {
        exists.quantity += 1;
      } else {
        next.push({
          productCode: product.code,
          name: product.name,
          quantity: 1,
          image: product.image,
          unitPriceCents: product.priceCents,
          children: [],
          isCombo: false,
        });
      }
      changes.push({ type: 'added', target: product.name, detail: `加了一份${product.name}`, after: product.name });
      continue;
    }

    if (!change.target) continue;
    const target = locateTarget(change.target, next);
    if (!target) {
      changes.push({
        type: 'unavailable',
        target: change.target,
        detail: `原方案里没有「${change.target}」，未改动`,
      });
      continue;
    }

    const item = next[target.itemIndex];

    // 子项级操作
    if (target.childIndex !== undefined) {
      const child = item.children[target.childIndex];

      if (change.type === 'remove') {
        const refill = refillRound(item, child, req.combos, req.menu);
        const filtered = item.children.filter((_, i) => i !== target.childIndex);
        item.children = refill ? [...filtered, refill] : filtered;
        changes.push({
          type: 'removed',
          target: child.name,
          detail: refill
            ? `去掉了${child.name}，该份套餐的${refill.roundName ?? '轮次'}需要重新选择，已补上「${refill.name}」`
            : `去掉了${child.name}`,
          before: child.name,
        });
        continue;
      }

      if (change.type === 'replace') {
        const { child: replaced, change: applied } = replaceChildInRound(item, child, change.replacement, req.combos, req.menu);
        if (replaced) item.children[target.childIndex] = replaced;
        changes.push(applied);
        continue;
      }
    }

    // 整项级操作
    if (change.type === 'remove') {
      next = next.filter((_, i) => i !== target.itemIndex);
      changes.push({ type: 'removed', target: item.name, detail: `整份去掉了${item.name}`, before: item.name });
      continue;
    }

    if (change.type === 'replace') {
      const replacement = change.replacement
        ? findBestProduct(change.replacement, req.menu, 0.4)
        : undefined;
      if (replacement) {
        next[target.itemIndex] = {
          productCode: replacement.code,
          name: replacement.name,
          quantity: item.quantity,
          image: replacement.image,
          unitPriceCents: replacement.priceCents,
          children: [],
          isCombo: false,
        };
        changes.push({
          type: 'replaced',
          target: item.name,
          detail: `${item.name} → ${replacement.name}`,
          before: item.name,
          after: replacement.name,
        });
      } else {
        changes.push({
          type: 'unavailable',
          target: item.name,
          detail: `没找到「${change.replacement ?? '替代品'}」，需要你确认`,
        });
      }
      continue;
    }

  }

  // 兜底：把用户没提到的项明确标记为「保留」，让界面能显示「这些没动」
  const touched = new Set(changes.map((c) => c.target));
  for (const item of items) {
    if (!touched.has(item.name)) {
      changes.push({ type: 'kept', target: item.name, detail: `${item.name} 保持不变` });
    }
  }

  return { items: next, changes };
}

/** 估算一份方案的大致金额（仅用于预算降级的启发式排序，最终一律以 MCP 核价为准）。 */
export function estimateCents(items: PlanItem[]): number {
  return items.reduce((sum, item) => sum + (item.unitPriceCents ?? 0) * item.quantity, 0);
}

export function buildCandidates(req: PlanRequest): CandidatePlan[] {
  const candidates: CandidatePlan[] = [];
  const { items, changes } = applyIntent(req, req.baseItems);
  const budget = req.intent.budgetCents ?? null;

  const hasAdd = changes.some((c) => c.type === 'added');
  const hasSwap = changes.some((c) => c.type === 'replaced');

  candidates.push({
    id: 'minimal',
    label: hasAdd || hasSwap ? '按你说的改' : '原样不变',
    strategy: 'minimal',
    items,
    changes,
    withinBudget: null,
    explain: buildExplain(req, changes, items),
  });

  // 第二种候选：只在「开放式替换」场景下提供，避免为了凑数制造噪音
  const openSwap = req.intent.changes.some((c) => c.type === 'replace' && !c.replacement);
  if (openSwap) {
    const altItems = cloneItems(items);
    // 保留 kept / added / removed 等记录，替换记录重算，避免两个候选共用同一句说明
    const swapChanges = changes.filter((c) => c.type !== 'replaced');
    let swapped = false;

    for (const change of req.intent.changes) {
      if (change.type !== 'replace' || change.replacement || !change.target) continue;

      // 关键：必须在「原始方案」上定位目标。此时目标还没被替换掉，
      // 若拿已应用修改的结果去定位，会因为名字已变而永远找不到。
      const t = locateTarget(change.target, req.baseItems);
      if (!t || t.childIndex === undefined) continue;

      const altItem = altItems[t.itemIndex];
      const altChild = altItem?.children[t.childIndex];
      if (!altChild) continue;

      const found = roundOf(altItem, altChild, req.combos);
      if (!found) continue;

      // 排除 minimal 已经选中的那一项，保证两个候选真的不一样
      const minimalPick = items[t.itemIndex]?.children.find((c) => c.round === String(found.round.id))?.code;
      const taken = new Set(altItem.children.map((c) => c.code));
      const pool = found.round.choices.filter(
        (c) => c.code !== altChild.code && c.code !== minimalPick && !taken.has(c.code),
      );
      const pick =
        pool.find((c) => c.diffPriceCents === 0 && c.isDefault) ?? pool.find((c) => c.diffPriceCents === 0) ?? pool[0];
      if (!pick) continue;

      altItem.children[t.childIndex] = {
        code: pick.code,
        name: pick.name,
        quantity: altChild.quantity,
        round: String(found.round.id),
        roundName: found.round.name,
        aliasNames: [altChild.name],
      };
      swapChanges.push({
        type: 'replaced',
        target: altChild.name,
        detail: `${found.round.name}：${altChild.name} → ${pick.name}（另一个搭配思路）`,
        before: altChild.name,
        after: pick.name,
      });
      swapped = true;
    }

    if (swapped) {
      candidates.push({
        id: 'swap-alt',
        label: '换个搭配思路',
        strategy: 'swap-fit',
        items: altItems,
        changes: swapChanges,
        withinBudget: null,
        explain: ['同一个轮次里的另一种搭配，你可以对比一下再决定'],
      });
    }
  }

  // 预算判定依赖真实核价结果，由上层在注入 price 后调用 markBudget 完成。
  // 这里只把预算上限透传出去，避免用估算值冒充真实金额。
  return candidates.map((c) => ({ ...c, withinBudget: budget === null ? null : null }));
}

/** 注入真实核价后，重新判定是否满足预算。 */
export function markBudget(candidate: CandidatePlan, budgetCents: number | null): CandidatePlan {
  if (budgetCents === null || !candidate.price) {
    return { ...candidate, withinBudget: null };
  }
  const within = candidate.price.priceCents <= budgetCents;
  return {
    ...candidate,
    withinBudget: within,
    budgetNote: within
      ? undefined
      : `超出预算 ¥${((candidate.price.priceCents - budgetCents) / 100).toFixed(2)}（你设的上限是 ¥${(
          budgetCents / 100
        ).toFixed(2)}）`,
  };
}

function buildExplain(req: PlanRequest, changes: AppliedChange[], items: PlanItem[]): string[] {
  const lines: string[] = [];

  const kept = changes.filter((c) => c.type === 'kept');
  if (kept.length > 0) {
    lines.push(`保留了 ${kept.map((k) => k.target).join('、')}`);
  }

  const modified = changes.filter((c) => c.type !== 'kept');
  if (modified.length === 0) {
    lines.push(`没有具体改动，按原方案准备`);
  } else {
    for (const m of modified) {
      if (m.type === 'replaced' || m.type === 'removed' || m.type === 'added') lines.push(m.detail);
    }
  }

  if (req.intent.budgetCents) {
    lines.push(`预算上限 ¥${(req.intent.budgetCents / 100).toFixed(2)}`);
  }

  const unavailable = changes.filter((c) => c.type === 'unavailable');
  if (unavailable.length > 0) {
    lines.push(`有 ${unavailable.length} 项没能落实：${unavailable.map((u) => u.target).join('、')}`);
  }

  lines.push(`共 ${items.reduce((n, i) => n + i.quantity, 0)} 件商品`);
  return lines;
}
