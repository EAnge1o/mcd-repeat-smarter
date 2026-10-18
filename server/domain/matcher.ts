/**
 * 餐品身份匹配层。
 *
 * 为什么需要这一层（来自真实 MCP 数据验证）：
 * 1. 历史订单里的 productCode 会失效。实测：用户历史常点的「随心配1+1」(9900010829)
 *    和「精选超值随心配」(9900013291) 在当前菜单都已不在售，只能用同名在售商品替代。
 * 2. 历史订单的套餐子项不返回所属轮次（rounds[].id），而下单和核价必须传 roundList。
 * 3. 用户口中的「薯饼」「饮料」是口语，需要映射到真实商品编码。
 *
 * 匹配优先级：编码精确 → 名称精确 → 名称归一化模糊 → 同轮次替代 → 无法匹配。
 * 任何降级都会在 reason 里写明，并且最终必须让用户在界面上看到。
 */

import type { ComboDetail, MatchStatus, MatchedChild, MatchedItem, MenuProduct, PlanChild, PlanItem } from './types.js';

export interface MatchContext {
  menu: MenuProduct[];
  /** 已拉取的套餐详情，key = productCode */
  combos: Map<string, ComboDetail>;
}

/** 归一化商品名：去括号补充说明、去空格、统一全角括号。 */
export function normalizeName(input: string): string {
  return input
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s\u3000]/g, '')
    .toLowerCase();
}

/** 去掉数字、符号、字母，只留中文核心词。用于「随心配1+1」≈「人气经典随心配」这类匹配。 */
export function coreWord(input: string): string {
  return input.replace(/[0-9a-zA-Z+＋\-—_/·.，,。、\s()（）]/g, '');
}

/** 名称相似度：完全相等 1；包含关系按长度比；核心词包含给较高分；否则按二元组重合度。 */
export function nameSimilarity(a: string, b: string): number {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) {
    const shorter = x.length <= y.length ? x : y;
    const ratio = shorter.length / Math.max(x.length, y.length);
    // 中文商品名多为「修饰语 + 品类」（人气经典随心配 / 随心配）：
    // 较短者达到 3 个字时，包含关系本身就有很强的指示性，不应被长度比压低。
    if (shorter.length >= 3) return Math.max(0.72, ratio);
    return ratio;
  }

  // 核心词比对：「随心配1+1」的核心词是「随心配」，是「人气经典随心配」的子串
  const cx = coreWord(x);
  const cy = coreWord(y);
  if (cx && cy && cx !== x) {
    if (cx === cy) return 0.95;
    if (cx.includes(cy) || cy.includes(cx)) {
      const ratio = Math.min(cx.length, cy.length) / Math.max(cx.length, cy.length);
      // 核心词越完整，分越高；最低 0.65，避免把「随心配」匹配到毫不相干的商品
      return 0.65 + 0.35 * ratio;
    }
  }

  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i += 1) set.add(s.slice(i, i + 2));
    return set;
  };
  const bx = bigrams(x);
  const by = bigrams(y);
  if (bx.size === 0 || by.size === 0) return 0;
  let hit = 0;
  for (const g of bx) if (by.has(g)) hit += 1;
  return hit / Math.max(bx.size, by.size);
}

/** 在菜单里找一个最像的商品（用于口语 → 编码）。阈值防止乱配。 */
export function findBestProduct(query: string, menu: MenuProduct[], threshold = 0.5): MenuProduct | undefined {
  let best: { p: MenuProduct; score: number } | undefined;
  for (const p of menu) {
    const score = nameSimilarity(query, p.name);
    if (score >= threshold && (!best || score > best.score)) {
      best = { p, score };
    }
  }
  return best?.p;
}

/**
 * 推断历史子项属于哪个轮次。
 * 历史订单不带 round 信息：优先用当前套餐定义反查；反查不到则按出现顺序兜底。
 */
export function inferRound(childCode: string, index: number, combo?: ComboDetail): { round?: string; roundName?: string } {
  if (!combo || combo.rounds.length === 0) return {};
  for (const r of combo.rounds) {
    if (r.choices.some((c) => c.code === childCode)) {
      return { round: String(r.id), roundName: r.name };
    }
  }
  const fallback = combo.rounds[index];
  return fallback ? { round: String(fallback.id), roundName: fallback.name } : {};
}

/** 同一轮次内的替代候选：优先同名同款、其次同品类、最后按价格接近程度。 */
export function alternativesInRound(
  child: PlanChild,
  combo: ComboDetail,
  roundId: string | undefined,
  limit = 3,
): { code: string; name: string; diffPrice?: string }[] {
  if (!combo) return [];
  const round = roundId ? combo.rounds.find((r) => String(r.id) === roundId) : undefined;
  if (!round) return [];

  const scored = round.choices
    .filter((c) => c.code !== child.code)
    .map((c) => {
      const sim = nameSimilarity(child.name, c.name);
      const sameSuffix = normalizeName(child.name).slice(-1) === normalizeName(c.name).slice(-1) ? 0.15 : 0;
      // 零差价优先（不额外加钱）
      const pricePenalty = Math.abs(c.diffPriceCents) / 10_000;
      return { c, score: sim + sameSuffix - pricePenalty };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => ({ code: s.c.code, name: s.c.name, diffPrice: s.c.diffPrice }));
}

function matchChild(child: PlanChild, index: number, combo: ComboDetail | undefined): MatchedChild {
  const inferred = inferRound(child.code, index, combo);

  // 1) 编码在当前套餐该轮次内仍可售
  if (combo) {
    for (const r of combo.rounds) {
      const hit = r.choices.find((c) => c.code === child.code);
      if (hit) {
        return {
          original: child,
          status: 'exact',
          current: {
            ...child,
            name: hit.name,
            round: String(r.id),
            roundName: r.name,
            ...(hit.name !== child.name ? { aliasNames: [child.name] } : {}),
          },
          alternatives: [],
          reason: `${hit.name} 仍在${r.name}可选`,
        };
      }
    }

    // 2) 编码失效 → 先在整个套餐的所有轮次里按名称找，再退回推断轮次做替代。
    //    历史订单不返回轮次归属，只按推断轮次搜索会把「换了轮次的同名商品」误判为已下架。
    let bestChoice: { code: string; name: string; roundId: string; roundName: string } | undefined;
    let bestScore = 0;
    for (const r of combo.rounds) {
      for (const c of r.choices) {
        const score = nameSimilarity(child.name, c.name);
        if (score > bestScore) {
          bestScore = score;
          bestChoice = { code: c.code, name: c.name, roundId: String(r.id), roundName: r.name };
        }
      }
    }

    if (bestChoice && bestScore >= 0.5) {
      return {
        original: child,
        status: 'renamed',
        current: {
          ...child,
          code: bestChoice.code,
          name: bestChoice.name,
          round: bestChoice.roundId,
          roundName: bestChoice.roundName,
          ...(bestChoice.name !== child.name ? { aliasNames: [child.name] } : {}),
        },
        alternatives: [],
        reason: `「${child.name}」现在是${bestChoice.roundName}的「${bestChoice.name}」`,
      };
    }

    const round = combo.rounds.find((r) => String(r.id) === inferred.round);
    if (round) {
      const alts = alternativesInRound(child, combo, inferred.round);
      const first = alts[0];
      if (first) {
        return {
          original: child,
          status: 'substituted',
          current: {
            ...child,
            code: first.code,
            name: first.name,
            round: String(round.id),
            roundName: round.name,
            ...(first.name !== child.name ? { aliasNames: [child.name] } : {}),
          },
          alternatives: alts.slice(1),
          reason: `「${child.name}」在当前${round.name}已下架，替换为「${first.name}」`,
        };
      }
    }

    return {
      original: child,
      status: 'unavailable',
      current: undefined,
      alternatives: [],
      reason: `「${child.name}」已下架，且当前套餐没有可替换项`,
    };
  }

  // 没有套餐定义（如单品），保持原样
  return { original: child, status: 'exact', current: { ...child }, alternatives: [], reason: '' };
}

export function matchItem(item: PlanItem, ctx: MatchContext): MatchedItem {
  const notes: string[] = [];

  // 1) 编码精确在售
  const exact = ctx.menu.find((p) => p.code === item.productCode);
  if (exact) {
    const combo = ctx.combos.get(exact.code);
    const children = item.children.map((c, i) => matchChild(c, i, combo));
    for (const c of children) if (c.status !== 'exact') notes.push(c.reason);
    return {
      original: item,
      status: 'exact',
      current: {
        ...item,
        name: exact.name,
        image: exact.image ?? item.image,
        unitPriceCents: exact.priceCents,
        ...(exact.name !== item.name ? { aliasNames: [item.name] } : {}),
        children: children.map((c) => c.current ?? c.original),
      },
      children,
      notes,
    };
  }

  // 2) 名称匹配（MCP 换码场景）
  const byName = ctx.menu.find((p) => normalizeName(p.name) === normalizeName(item.name));
  if (byName) {
    const combo = ctx.combos.get(byName.code);
    const children = item.children.map((c, i) => matchChild(c, i, combo));
    const reason = `「${item.name}」对应现在的「${byName.name}」`;
    return {
      original: item,
      status: 'renamed',
      current: {
        ...item,
        productCode: byName.code,
        name: byName.name,
        image: byName.image ?? item.image,
        unitPriceCents: byName.priceCents,
        ...(byName.name !== item.name ? { aliasNames: [item.name] } : {}),
        children: children.map((c) => c.current ?? c.original),
      },
      children,
      notes: [reason, ...children.filter((c) => c.status !== 'exact').map((c) => c.reason)],
    };
  }

  // 3) 模糊同名（核心词命中即可，例如「随心配1+1」→「人气经典随心配」）
  const fuzzy = findBestProduct(item.name, ctx.menu, 0.62);
  if (fuzzy) {
    const combo = ctx.combos.get(fuzzy.code);
    const children = item.children.map((c, i) => matchChild(c, i, combo));
    return {
      original: item,
      status: 'renamed',
      current: {
        ...item,
        productCode: fuzzy.code,
        name: fuzzy.name,
        image: fuzzy.image ?? item.image,
        unitPriceCents: fuzzy.priceCents,
        ...(fuzzy.name !== item.name ? { aliasNames: [item.name] } : {}),
        children: children.map((c) => c.current ?? c.original),
      },
      children,
      notes: [`「${item.name}」现在叫「${fuzzy.name}」`],
    };
  }

  // 4) 已下架
  return {
    original: item,
    status: 'unavailable',
    current: undefined,
    children: [],
    notes: [`「${item.name}」当前门店已不在售`],
  };
}

export function matchPlan(items: PlanItem[], ctx: MatchContext): MatchedItem[] {
  return items.map((item) => matchItem(item, ctx));
}

/** 汇总匹配状态，供 UI 决定提示级别。 */
export function summarizeMatch(matched: MatchedItem[]): {
  exact: number;
  adjusted: number;
  unavailable: number;
  hasRisk: boolean;
} {
  let exact = 0;
  let adjusted = 0;
  let unavailable = 0;
  for (const m of matched) {
    if (m.status === 'exact') {
      const childAdjusted = m.children.some((c) => c.status !== 'exact');
      if (childAdjusted) adjusted += 1;
      else exact += 1;
    } else if (m.status === 'unavailable') {
      unavailable += 1;
    } else {
      adjusted += 1;
    }
  }
  return { exact, adjusted, unavailable, hasRisk: adjusted > 0 || unavailable > 0 };
}

export function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'exact':
      return '仍可点';
    case 'renamed':
      return '已更名';
    case 'substituted':
      return '已替换';
    case 'unavailable':
      return '已下架';
    default:
      return '待确认';
  }
}
