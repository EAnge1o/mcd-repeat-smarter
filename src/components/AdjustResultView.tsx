import type { CandidatePlan, PlanItem } from '../../server/domain/types';
import type { AdjustResult, MatchedView } from '../api';
import { Alert, Badge, cx } from './ui';
import { IconAlert, IconArrow, IconCheck, IconReceipt } from './Icons';

const yuan = (cents?: number) => (cents === undefined ? '—' : (cents / 100).toFixed(2));

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'exact':
      return <Badge tone="ok">仍可点</Badge>;
    case 'renamed':
      return <Badge tone="warn">编码已更新</Badge>;
    case 'substituted':
      return <Badge tone="warn">已替换</Badge>;
    case 'unavailable':
      return <Badge tone="danger">已下架</Badge>;
    default:
      return <Badge tone="neutral">{status}</Badge>;
  }
}

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

  const toneOf = (k: string) =>
    k === 'remove' || k === 'budget' ? 'danger' : k === 'add' ? 'ok' : k === 'replace' ? 'warn' : 'neutral';

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t, i) => (
        <Badge key={i} tone={toneOf(t.kind) as 'neutral' | 'ok' | 'warn' | 'danger'}>
          {t.text}
        </Badge>
      ))}
    </div>
  );
}

/** 商品身份匹配结果：把「你上次点的东西现在还在不在」摆在明面上。 */
function MatchNotice({ matched, summary }: { matched: MatchedView[]; summary: AdjustResult['matchSummary'] }) {
  if (!summary.hasRisk) {
    return (
      <p className="flex items-center gap-1.5 text-[11.5px] text-[#3f6b52]">
        <IconCheck size={12} />
        原方案里的商品当前都还能点到
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {matched.map((m, i) => {
        const risky = m.status !== 'exact' || m.children.some((c) => c.status !== 'exact');
        if (!risky) return null;
        return (
          <Alert key={i} kind="warn" title={m.name}>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge status={m.status} />
              {m.currentName && m.currentName !== m.name ? <span>现已对应「{m.currentName}」</span> : null}
            </div>

            {m.children
              .filter((c) => c.status !== 'exact')
              .map((c, j) => (
                <div key={j} className="mt-1">
                  子项「{c.name}」{c.status === 'substituted' ? '已下架，替换为' : '编码变更，对应'}「{c.currentName}」
                  {c.alternatives.length > 0 ? (
                    <span className="opacity-80">（也可选：{c.alternatives.map((a) => `${a.name} ${a.diffPrice ?? ''}`).join('、')}）</span>
                  ) : null}
                </div>
              ))}

            {m.notes.map((n, k) => (
              <div key={k} className="mt-1 opacity-85">
                {n}
              </div>
            ))}
          </Alert>
        );
      })}
    </div>
  );
}

function ChildTags({ tags }: { tags: { name: string; changed?: boolean }[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 pl-7">
      {tags.map((t, i) => (
        <span key={i} className={cx('text-[10px] leading-relaxed', t.changed ? 'text-[#7a5a1c]' : 'text-ink-faint')}>
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
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div className="rounded-2xl bg-[#f6f1ec] p-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">原方案</span>
          <span className="tnum font-mono text-[9.5px] text-ink-faint">共 {matched.reduce((n, m) => n + m.quantity, 0)} 件</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {matched.map((m, i) => {
            const gone = m.status === 'unavailable' || removed.has(m.name);
            return (
              <div key={i}>
                <div className="flex items-baseline gap-2">
                  <span className="tnum w-5 shrink-0 text-right font-mono text-[9.5px] text-ink-faint">{m.quantity}×</span>
                  <span className={cx('truncate text-[12px]', gone ? 'text-ink-faint line-through' : 'text-ink-soft')} title={m.name}>
                    {m.name}
                  </span>
                </div>
                <ChildTags tags={m.children.map((c) => ({ name: c.name, changed: c.status !== 'exact' }))} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="hidden justify-center sm:flex" aria-hidden="true">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-ink-faint shadow-pill ring-1 ring-line">
          <IconArrow size={12} />
        </span>
      </div>

      <div className="rounded-2xl bg-blush p-4 ring-1 ring-inset ring-[#f6dcd6]">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow text-brand-700">调整后</span>
          <span className="tnum font-mono text-[9.5px] text-ink-faint">共 {count(candidate.items)} 件</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {candidate.items.length === 0 ? (
            <p className="text-[11px] text-ink-faint">这一版没有任何餐品</p>
          ) : (
            candidate.items.map((item, i) => (
              <div key={`${item.productCode}-${i}`}>
                <div className="flex items-baseline gap-2">
                  <span className="tnum w-5 shrink-0 text-right font-mono text-[9.5px] text-ink-faint">{item.quantity}×</span>
                  <span
                    className={cx('truncate text-[12px]', added.has(item.name) ? 'font-medium text-brand-700' : 'text-ink')}
                    title={item.name}
                  >
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

function CandidateCard({ candidate, active, onSelect }: { candidate: CandidatePlan; active: boolean; onSelect: () => void }) {
  const price = candidate.price;
  const changedNames = new Set(candidate.changes.filter((c) => c.type === 'replaced').map((c) => c.after ?? ''));
  const notes = candidate.explain.slice(0, 3);

  return (
    <div
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
      className={cx(
        'cursor-pointer rounded-2xl p-4 transition-[background-color,box-shadow] duration-200 ease-out',
        active
          ? 'bg-white shadow-panel ring-1 ring-inset ring-brand-300'
          : 'bg-[#fbf7f3] ring-1 ring-inset ring-transparent hover:bg-[#f8f2ec]',
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cx(
            'mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-colors duration-200',
            active ? 'border-brand-500 bg-brand-500' : 'border-[#d8d0c8] bg-white',
          )}
          aria-hidden="true"
        >
          {active ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-ink">{candidate.label}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {candidate.withinBudget === true ? <Badge tone="ok">在预算内</Badge> : null}
            {candidate.withinBudget === false ? <Badge tone="danger">超预算</Badge> : null}
            {price && price.discountCents > 0 ? <Badge tone="warn">已省 ¥{yuan(price.discountCents)}</Badge> : null}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {price ? (
            <>
              <div className="tnum display text-[19px] leading-none text-ink">
                <span className="mr-0.5 font-sans text-[11px] font-normal text-ink-faint">¥</span>
                {yuan(price.priceCents)}
              </div>
              {price.originalPriceCents > price.priceCents ? (
                <div className="tnum mt-1 font-mono text-[9.5px] text-ink-faint line-through">¥{yuan(price.originalPriceCents)}</div>
              ) : null}
            </>
          ) : (
            <div className="text-[11px] text-brand-700">核价失败</div>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1 border-t border-white/70 pt-3">
        {candidate.items.map((item, i) => (
          <div key={`${item.productCode}-${i}`}>
            <div className="flex items-baseline gap-2">
              <span className="tnum w-4 shrink-0 text-right font-mono text-[9.5px] text-ink-faint">{item.quantity}</span>
              <span className="truncate text-[12px] text-ink-soft">{item.name}</span>
            </div>
            {item.children.length > 0 ? (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-[24px]">
                {item.children.map((c, j) => (
                  <span
                    key={j}
                    className={cx(
                      'text-[10px] leading-relaxed',
                      changedNames.has(c.name) || (c.aliasNames && c.aliasNames.length > 0) ? 'text-[#7a5a1c]' : 'text-ink-faint',
                    )}
                  >
                    {c.roundName ? `${c.roundName}·` : ''}
                    {c.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {candidate.budgetNote || (candidate.priceChecks && candidate.priceChecks.length > 0) || notes.length > 0 ? (
        <div className="mt-2.5 space-y-1 border-t border-white/70 pt-2.5">
          {candidate.budgetNote ? (
            <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-[#7a5a1c]">
              <IconAlert size={11} className="mt-0.5 shrink-0" />
              <span>{candidate.budgetNote}。系统不会为了凑预算偷偷换掉你要的东西。</span>
            </p>
          ) : null}
          {(candidate.priceChecks ?? []).map((n, i) => (
            <p key={i} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-[#7a5a1c]">
              <IconAlert size={11} className="mt-0.5 shrink-0" />
              <span>{n}</span>
            </p>
          ))}
          {notes.map((e, i) => (
            <p key={i} className="text-[10.5px] leading-relaxed text-ink-faint">
              {e}
            </p>
          ))}
        </div>
      ) : null}

      {price ? (
        <div className="mt-2.5 flex items-center justify-between gap-2 text-[9.5px] text-ink-faint">
          <span className="flex items-center gap-1.5">
            <IconReceipt size={10} />
            官方核价 · 共 {price.lines.reduce((n, l) => n + l.quantity, 0)} 件
          </span>
          {price.traceId ? <span className="tnum font-mono">trace {price.traceId.slice(0, 8)}</span> : null}
        </div>
      ) : null}
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
    <div className="space-y-5">
      {/* 用户原话 + 解析出的修改点：先让用户确认「我理解对了没有」 */}
      <div className="rounded-2xl bg-cream px-5 py-4">
        <p className="eyebrow">你刚才说</p>
        <p className="display mt-2 text-[16px] leading-[1.6] text-ink md:text-[17px]">「{result.intent.raw}」</p>
        <ChangeTags result={result} />
      </div>

      {result.intent.unrecognized.length > 0 ? (
        <Alert kind="warn" title="有一部分没听懂">
          「{result.intent.unrecognized.join('、')}」这部分没能转成具体修改。可以换个说法，例如「不要薯条」「薯条换成玉米杯」「不超过 20 元」。
        </Alert>
      ) : null}

      <MatchNotice matched={result.matched} summary={result.matchSummary} />

      {allOverBudget ? (
        <Alert kind="error" title={`没有方案能压到 ¥${(result.intent.budgetCents! / 100).toFixed(0)} 以内`}>
          下面列出的是最接近的选项。你可以放宽预算，或告诉我可以减少哪一项。
        </Alert>
      ) : null}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="display text-[17px] text-ink">改了什么</h3>
          <span className="eyebrow">前后对照</span>
        </div>
        <Compare matched={result.matched} candidate={selected} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="display text-[17px] text-ink">候选方案</h3>
          <span className="tnum font-mono text-[9.5px] text-ink-faint">{result.candidates.length} 个</span>
        </div>
        <div className="space-y-2.5" role="radiogroup" aria-label="候选方案">
          {result.candidates.map((c) => (
            <CandidateCard key={c.id} candidate={c} active={c.id === selected.id} onSelect={() => onSelect(c.id)} />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t border-hair pt-4">
        <button
          type="button"
          onClick={onSave}
          disabled={!selected.price}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[11.5px] font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors duration-200 hover:bg-ink hover:text-white active:scale-[0.97] disabled:opacity-35"
        >
          存成常用方案
          <IconArrow size={10} />
        </button>
        <span className="text-[10.5px] text-ink-faint">下次说「还是老样子」就能调出来</span>
      </div>
    </div>
  );
}
