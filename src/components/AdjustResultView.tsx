import type { CandidatePlan, PlanItem } from '../../server/domain/types';
import type { AdjustResult, MatchedView } from '../api';
import { StatusBadge } from './Common';
import { IconAlert, IconArrow, IconCheck, IconReceipt, IconSparkle } from './Icons';

const yuan = (cents?: number) => (cents === undefined ? '—' : (cents / 100).toFixed(2));
/** 把解析出的意图渲染成用户能复核的标签 —— 让「AI 理解了什么」可见。 */
function ChangeTags({ result }: { result: AdjustResult }) {
  const { intent } = result;
  const tags: { kind: string; text: string }[] = [];

  if (intent.wantsRepeat) tags.push({ kind: 'keep', text: '照旧 / 保留原方案' });

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

  if (tags.length === 0) {
    tags.push({ kind: 'keep', text: '按原方案' });
  }

  return (
    <div className="change-tags">
      {tags.map((t, i) => (
        <span key={i} className={`change-tag change-tag--${t.kind}`}>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink-400)' }}>
        <IconCheck size={14} />
        原方案里的商品当前都还能点
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      {matched.map((m, i) => {
        const risky = m.status !== 'exact' || m.children.some((c) => c.status !== 'exact');
        if (!risky) return null;
        return (
          <div key={i} className="alert alert--warn" style={{ alignItems: 'flex-start' }}>
            <IconAlert />
            <div className="alert__body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700 }}>{m.name}</span>
                <StatusBadge status={m.status} />
                {m.currentName && m.currentName !== m.name && (
                  <span style={{ fontSize: 12.5 }}>
                    → 现已对应「{m.currentName}」
                  </span>
                )}
              </div>

              {m.children
                .filter((c) => c.status !== 'exact')
                .map((c, j) => (
                  <div key={j} style={{ fontSize: 12.5, marginTop: 5 }}>
                    子项「{c.name}」{c.status === 'substituted' ? '已下架，替换为' : '编码变更，对应'}
                    「{c.currentName}」
                    {c.alternatives.length > 0 && (
                      <span style={{ opacity: 0.75 }}>（也可选：{c.alternatives.map((a) => `${a.name} ${a.diffPrice ?? ''}`).join('、')}）</span>
                    )}
                  </div>
                ))}

              {m.notes.map((n, k) => (
                <div key={k} style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
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

function ItemLine({ item, mode }: { item: PlanItem; mode: 'before' | 'after' }) {
  return (
    <div>
      <div className="diff__row">
        <span className="item-pill__qty" style={{ minWidth: 20 }}>
          {item.quantity}×
        </span>
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
      </div>
      {item.children.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 30, marginTop: 3 }}>
          {item.children.map((c, i) => (
            <span key={i} className={`child-tag${mode === 'after' && c.aliasNames && c.aliasNames.length > 0 ? ' child-tag--changed' : ''}`}>
              {c.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffView({ matched, candidate }: { matched: MatchedView[]; candidate: CandidatePlan }) {
  const beforeItems = matched.map((m) => m);
  const afterItems = candidate.items;

  return (
    <div className="diff">
      <div className="diff__col">
        <div className="diff__head">原方案</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {beforeItems.map((m, i) => (
            <div key={i}>
              <div className={`diff__row${m.status === 'unavailable' ? ' diff__row--removed' : ''}`}>
                <span className="item-pill__qty" style={{ minWidth: 20 }}>
                  {m.quantity}×
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</span>
              </div>
              {m.children.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingLeft: 30, marginTop: 3 }}>
                  {m.children.map((c, j) => (
                    <span key={j} className={`child-tag${c.status !== 'exact' ? ' child-tag--changed' : ''}`}>
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="diff__col">
        <div className="diff__head">调整后</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {afterItems.length === 0 ? (
            <div className="muted tiny">没有商品</div>
          ) : (
            afterItems.map((item, i) => (
              <ItemLine key={i} item={item} mode="after" />
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
  const changedChildren = new Set(
    candidate.changes.filter((c) => c.type === 'replaced').map((c) => c.after ?? ''),
  );

  return (
    <div
      className={`candidate${active ? ' candidate--active' : ''}`}
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
      <div className="candidate__head">
        <span className="select-dot" />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="candidate__label">{candidate.label}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
            {candidate.withinBudget === true && (
              <span className="badge badge--ok">
                <IconCheck size={12} />
                在预算内
              </span>
            )}
            {candidate.withinBudget === false && (
              <span className="badge badge--red">
                <IconAlert size={12} />
                超预算
              </span>
            )}
            {candidate.price && candidate.price.discountCents > 0 && (
              <span className="badge badge--warn">已省 ¥{yuan(candidate.price.discountCents)}</span>
            )}
          </div>
        </div>
        <div className="candidate__price">
          {price ? (
            <>
              <div className="candidate__amount price-pop">
                <small>¥</small>
                {yuan(price.priceCents)}
              </div>
              {price.originalPriceCents > price.priceCents && (
                <div className="candidate__strike">¥{yuan(price.originalPriceCents)}</div>
              )}
            </>
          ) : (
            <div className="candidate__amount" style={{ fontSize: 14, color: 'var(--red-600)' }}>
              核价失败
            </div>
          )}
        </div>
      </div>

      <div className="candidate__items">
        {candidate.items.map((item, i) => (
          <div key={`${item.productCode}-${i}`} className="line-item">
            <span className="line-item__qty">{item.quantity}</span>
            <div className="line-item__body">
              <div className="line-item__name">{item.name}</div>
              {item.children.length > 0 && (
                <div className="line-item__children">
                  {item.children.map((c, j) => (
                    <span
                      key={j}
                      className={`child-tag${changedChildren.has(c.name) || (c.aliasNames && c.aliasNames.length > 0) ? ' child-tag--changed' : ''}`}
                    >
                      {c.roundName ? `${c.roundName}·` : ''}
                      {c.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {candidate.budgetNote && (
        <div className="check-row">
          <IconAlert size={15} />
          <span>{candidate.budgetNote}。系统不会为了凑预算偷偷换掉你要的东西。</span>
        </div>
      )}

      {candidate.priceChecks && candidate.priceChecks.length > 0 && (
        <div className="check-row">
          <IconAlert size={15} />
          <span>{candidate.priceChecks.join('；')}</span>
        </div>
      )}

      {candidate.explain.length > 0 && (
        <div className="candidate__explain">
          {candidate.explain.slice(0, 5).map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      )}

      {price && (
        <div className="candidate__foot">
          <span className="tiny muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <IconReceipt size={13} />
            官方核价 · 共 {price.lines.reduce((n, l) => n + l.quantity, 0)} 件
          </span>
          {price.traceId && (
            <span className="tiny" style={{ color: 'var(--ink-300)', fontFamily: 'var(--font-num)' }}>
              trace {price.traceId.slice(0, 8)}
            </span>
          )}
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
    <div className="stack">
      <div className="quote">
        <div className="quote__label">你刚才说</div>
        <div className="quote__text">{result.intent.raw}</div>
        <ChangeTags result={result} />
      </div>

      {result.intent.unrecognized.length > 0 && (
        <div className="alert alert--warn">
          <IconAlert />
          <div className="alert__body">
            <div className="alert__title">有一部分没听懂</div>
            <div>「{result.intent.unrecognized.join('、')}」这部分没能转成具体修改。你可以换个说法，例如「不要薯条」「薯条换成玉米杯」「不超过 20 元」。</div>
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

      <div className="card card--pad">
        <div className="section-title">
          <h2>改了什么</h2>
          <span className="section-title__hint">{result.intent.wantsRepeat ? '基于上次那份' : '基于原方案'}</span>
        </div>
        <DiffView matched={result.matched} candidate={selected} />
      </div>

      <div>
        <div className="section-title">
          <h2>候选方案</h2>
          <span className="section-title__hint">
            <IconSparkle size={12} /> 金额均来自官方核价
          </span>
        </div>
        <div className="stack" role="radiogroup" aria-label="候选方案">
          {result.candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} active={c.id === selected.id} onSelect={() => onSelect(c.id)} />
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn--ghost" onClick={onSave} disabled={!selected.price}>
          <IconArrow size={14} />
          存成常用方案
        </button>
        <span className="tiny muted" style={{ alignSelf: 'center' }}>
          下次直接说「还是老样子」就能调出来
        </span>
      </div>
    </div>
  );
}
