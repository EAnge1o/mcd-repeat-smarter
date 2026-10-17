import type { CandidatePlan, PlanItem } from '../../server/domain/types';
import type { AdjustResult, MatchedView } from '../api';
import { SectionHead, StatusBadge } from './Common';
import { IconAlert, IconArrow, IconCheck, IconReceipt } from './Icons';

const yuan = (cents?: number) => (cents === undefined ? '—' : (cents / 100).toFixed(2));

/** 把解析出的意图渲染成可复核的标签 —— 让「AI 理解了什么」看得见、可纠正。 */
function ChangeTags({ result }: { result: AdjustResult }) {
  const { intent } = result;
  const tags: { kind: string; text: string }[] = [];

  if (intent.wantsRepeat) tags.push({ kind: 'keep', text: '照旧 · 保留原方案' });

  for (const c of intent.changes) {
    if (c.type === 'keep') continue;
    if (c.type === 'budget' && c.amountCents) {
      tags.push({ kind: 'budget', text: `预算 ≤ ¥${(c.amountCents / 100).toFixed(0)}` });
    } else if (c.type === 'remove' && c.target) {
      tags.push({ kind: 'remove', text: `去掉 ${c.target}` });
    } else if (c.type === 'replace' && c.target) {
      tags.push({ kind: 'replace', text: c.replacement ? `${c.target} → ${c.replacement}` : `${c.target} 换个别的` });
    } else if (c.type === 'add' && c.target) {
      tags.push({ kind: 'add', text: `加 ${c.target}` });
    } else if (c.type === 'preference' && c.preference) {
      tags.push({ kind: 'pref', text: c.preference });
    }
  }

  if (tags.length === 0) tags.push({ kind: 'keep', text: '按原方案' });

  return (
    <div className="said__chips">
      {tags.map((t, i) => (
        <span key={i} className={`tag tag--${t.kind}`}>
          {t.text}
        </span>
      ))}
    </div>
  );
}

/** 商品身份匹配结果：把「你上次点的东西现在还在不在」摆在明面上。 */
function MatchNotice({ matched, summary }: { matched: MatchedView[]; summary: AdjustResult['matchSummary'] }) {
  if (!summary.hasRisk) {
    return (
      <div className="tiny" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <IconCheck size={13} />
        原方案里的商品当前都还能点到
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {matched.map((m, i) => {
        const risky = m.status !== 'exact' || m.children.some((c) => c.status !== 'exact');
        if (!risky) return null;
        return (
          <div key={i} className="alert alert--warn">
            <IconAlert />
            <div className="alert__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{m.name}</span>
                <StatusBadge status={m.status} />
                {m.currentName && m.currentName !== m.name && <span className="tiny">→ 现已对应「{m.currentName}」</span>}
              </div>

              {m.children
                .filter((c) => c.status !== 'exact')
                .map((c, j) => (
                  <div key={j} className="tiny" style={{ marginTop: 4 }}>
                    子项「{c.name}」{c.status === 'substituted' ? '已下架，替换为' : '编码变更，对应'}「{c.currentName}」
                    {c.alternatives.length > 0 && (
                      <span style={{ opacity: 0.75 }}>
                        （也可选：{c.alternatives.map((a) => `${a.name} ${a.diffPrice ?? ''}`).join('、')}）
                      </span>
                    )}
                  </div>
                ))}

              {m.notes.map((n, k) => (
                <div key={k} className="tiny" style={{ marginTop: 3, opacity: 0.85 }}>
                  {n}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChildTags({ tags }: { tags: { name: string; changed?: boolean }[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="cmp__kids">
      {tags.map((t, i) => (
        <span key={i} className={t.changed ? 'cmp__kid--changed' : undefined}>
          {t.name}
        </span>
      ))}
    </div>
  );
}

/** 原方案 → 调整后：两栏并列，中间一个方向箭头 */
function Compare({ matched, candidate }: { matched: MatchedView[]; candidate: CandidatePlan }) {
  const removed = new Set(candidate.changes.filter((c) => c.type === 'removed' || c.type === 'unavailable').map((c) => c.before ?? c.target));
  const added = new Set(candidate.changes.filter((c) => c.type === 'added').map((c) => c.after ?? c.target));
  const count = (items: PlanItem[]) => items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="cmp">
      <div className="cmp__col">
        <div className="cmp__head">
          <span className="cmp__title">原方案</span>
          <span className="cmp__count">共 {matched.reduce((n, m) => n + m.quantity, 0)} 件</span>
        </div>
        <div className="cmp__rows">
          {matched.map((m, i) => {
            const gone = m.status === 'unavailable' || removed.has(m.name);
            return (
              <div key={i}>
                <div className={`cmp__row${gone ? ' cmp__row--removed' : ''}`}>
                  <span className="cmp__qty">{m.quantity}×</span>
                  <span className="cmp__nm" title={m.name}>
                    {m.name}
                  </span>
                </div>
                <ChildTags tags={m.children.map((c) => ({ name: c.name, changed: c.status !== 'exact' }))} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="cmp__mid" aria-hidden="true">
        <span>
          <IconArrow size={14} />
        </span>
      </div>

      <div className="cmp__col cmp__col--after">
        <div className="cmp__head">
          <span className="cmp__title">调整后</span>
          <span className="cmp__count">共 {count(candidate.items)} 件</span>
        </div>
        <div className="cmp__rows">
          {candidate.items.length === 0 ? (
            <div className="tiny muted">这一版没有任何餐品</div>
          ) : (
            candidate.items.map((item, i) => (
              <div key={`${item.productCode}-${i}`}>
                <div className={`cmp__row${added.has(item.name) ? ' cmp__row--added' : ''}`}>
                  <span className="cmp__qty">{item.quantity}×</span>
                  <span className="cmp__nm" title={item.name}>
                    {item.name}
                  </span>
                </div>
                <ChildTags
                  tags={item.children.map((c) => ({ name: c.name, changed: Boolean(c.aliasNames && c.aliasNames.length > 0) }))}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function CandidateCard({
  candidate,
  active,
  onSelect,
}: {
  candidate: CandidatePlan;
  active: boolean;
  onSelect: () => void;
}) {
  const price = candidate.price;
  const changedNames = new Set(candidate.changes.filter((c) => c.type === 'replaced').map((c) => c.after ?? ''));

  return (
    <div
      className={`cand${active ? ' cand--active' : ''}`}
      role="radio"
      aria-checked={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="cand__head">
        <span className="radio" aria-hidden="true" />
        <div className="cand__main">
          <div className="cand__label">{candidate.label}</div>
          <div className="cand__badges">
            {candidate.withinBudget === true && (
              <span className="badge badge--ok">
                <IconCheck size={11} />
                在预算内
              </span>
            )}
            {candidate.withinBudget === false && (
              <span className="badge badge--red">
                <IconAlert size={11} />
                超预算
              </span>
            )}
            {candidate.price && candidate.price.discountCents > 0 && (
              <span className="badge badge--warn">已省 ¥{yuan(candidate.price.discountCents)}</span>
            )}
          </div>
        </div>

        <div className="cand__price">
          {price ? (
            <>
              <div className="cand__amount num">
                <small>¥</small>
                {yuan(price.priceCents)}
              </div>
              {price.originalPriceCents > price.priceCents && (
                <div className="cand__strike">¥{yuan(price.originalPriceCents)}</div>
              )}
            </>
          ) : (
            <div className="cand__amount num" style={{ fontSize: 14, color: 'var(--red)' }}>
              核价失败
            </div>
          )}
        </div>
      </div>

      <div className="cand__items">
        {candidate.items.map((item, i) => (
          <div key={`${item.productCode}-${i}`}>
            <div className="cand__line">
              <span className="cand__qty">{item.quantity}</span>
              <span className="cand__nm">{item.name}</span>
            </div>
            {item.children.length > 0 && (
              <div className="cand__kids">
                {item.children.map((c, j) => (
                  <span
                    key={j}
                    className={
                      changedNames.has(c.name) || (c.aliasNames && c.aliasNames.length > 0)
                        ? 'cand__kid--changed'
                        : undefined
                    }
                  >
                    {c.roundName ? `${c.roundName}·` : ''}
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {(candidate.budgetNote || (candidate.priceChecks && candidate.priceChecks.length > 0) || candidate.explain.length > 0) && (
        <div className="cand__notes">
          {candidate.budgetNote && (
            <div className="cand__note cand__note--warn">
              <IconAlert size={12} />
              <span>{candidate.budgetNote}。系统不会为了凑预算偷偷换掉你要的东西。</span>
            </div>
          )}
          {candidate.priceChecks &&
            candidate.priceChecks.map((n, i) => (
              <div key={i} className="cand__note cand__note--warn">
                <IconAlert size={12} />
                <span>{n}</span>
              </div>
            ))}
          {candidate.explain.slice(0, 4).map((e, i) => (
            <div key={i} className="cand__note cand__note--plain">
              {e}
            </div>
          ))}
        </div>
      )}

      {price && (
        <div className="cand__foot">
          <span className="cand__foot-left">
            <IconReceipt size={12} />
            官方核价 · 共 {price.lines.reduce((n, l) => n + l.quantity, 0)} 件
          </span>
          {price.traceId && <span>trace {price.traceId.slice(0, 8)}</span>}
        </div>
      )}
    </div>
  );
}

export function AdjustResultView({
  result,
  selectedId,
  onSelect,
  onSave,
}: {
  result: AdjustResult;
  selectedId: string;
  onSelect: (id: string) => void;
  onSave: () => void;
}) {
  const selected = result.candidates.find((c) => c.id === selectedId) ?? result.candidates[0];
  const allOverBudget =
    result.intent.budgetCents !== null &&
    result.intent.budgetCents !== undefined &&
    result.candidates.length > 0 &&
    result.candidates.every((c) => c.withinBudget === false);

  return (
    <div className="result">
      {/* 用户原话 + 解析出的修改点：先让用户确认「我理解对了没有」 */}
      <div className="said">
        <div className="said__label">你刚才说</div>
        <div className="said__text">「{result.intent.raw}」</div>
        <ChangeTags result={result} />
      </div>

      {result.intent.unrecognized.length > 0 && (
        <div className="alert alert--warn">
          <IconAlert />
          <div className="alert__body">
            <div className="alert__title">有一部分没听懂</div>
            <div>
              「{result.intent.unrecognized.join('、')}」这部分没能转成具体修改。你可以换个说法，例如「不要薯条」「薯条换成玉米杯」「不超过 20 元」。
            </div>
          </div>
        </div>
      )}

      <MatchNotice matched={result.matched} summary={result.matchSummary} />

      {allOverBudget && (
        <div className="alert alert--error">
          <IconAlert />
          <div className="alert__body">
            <div className="alert__title">没有方案能压到 ¥{(result.intent.budgetCents! / 100).toFixed(0)} 以内</div>
            <div>下面列出的是最接近的选项。你可以放宽预算，或告诉我可以减少哪一项。</div>
          </div>
        </div>
      )}

      <section className="section section--flush">
        <SectionHead title="改了什么" desc="左边是你原来的，右边是这一次要下的" meta="前后对照" />
        <Compare matched={result.matched} candidate={selected} />
      </section>

      <section className="section section--flush">
        <SectionHead
          title="候选方案"
          desc="选一个再往下走，金额以官方接口为准"
          meta={`${result.candidates.length} 个`}
        />
        <div className="cands" role="radiogroup" aria-label="候选方案">
          {result.candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} active={c.id === selected.id} onSelect={() => onSelect(c.id)} />
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onSave} disabled={!selected.price}>
          存成常用方案
          <IconArrow size={12} />
        </button>
        <span className="tiny">下次说「还是老样子」就能调出来</span>
      </div>
    </div>
  );
}
