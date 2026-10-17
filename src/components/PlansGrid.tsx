import type { Plan } from '../../server/domain/types';
import { Badge, EmptyState, Skeleton, cx } from './ui';
import { IconCopy, IconEdit, IconPlus, IconSparkle, IconStore, IconTrash } from './Icons';
import { fmtDate } from '../lib/metrics';

interface PlansGridProps {
  plans: Plan[];
  loading?: boolean;
  onUse: (p: Plan) => void;
  onDuplicate: (p: Plan) => void;
  onRename: (p: Plan) => void;
  onDelete: (p: Plan) => void;
  /** 空状态下的主操作 */
  emptyAction?: React.ReactNode;
  className?: string;
}

const MAX_SHOWN = 3;

/**
 * 常用方案卡片。
 *
 * 刻意不显示方案总价：方案存的是商品编码，价格要按当前门店重新核。
 * 在这里给一个「记忆价」会让人以为下单就是这个数，而实际核价一旦变了就成了误导。
 */
export function PlansGrid({ plans, loading, onUse, onDuplicate, onRename, onDelete, emptyAction, className }: PlansGridProps) {
  if (loading) {
    return (
      <div className={cx('grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:p-5', className)}>
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-line p-4">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="mt-2.5 h-4 w-32" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-4/5" />
            <Skeleton className="mt-4 h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <EmptyState
        title="还没有保存的常用方案"
        desc="调好一单后点「存成常用方案」，下次说一句「还是老样子」就能整单调出来。"
        action={emptyAction}
      />
    );
  }

  return (
    <div className={cx('grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:p-5', className)}>
      {plans.map((p) => {
        const shown = p.items.slice(0, MAX_SHOWN);
        const rest = p.items.length - shown.length;
        const pieces = p.items.reduce((n, i) => n + i.quantity, 0);

        return (
          <article
            key={p.id}
            className="group flex flex-col rounded-lg border border-line bg-white p-3.5 transition-all duration-150 ease-out hover:border-[#e2dfd9] hover:shadow-card"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-[13px] font-semibold tracking-tight text-[#111827]" title={p.name}>
                  {p.name}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {p.tag ? <Badge tone="neutral">{p.tag}</Badge> : null}
                  {p.source === 'history' ? <Badge tone="neutral">来自历史</Badge> : null}
                  <span className="tnum text-[10px] text-[#a8a49c]">{pieces} 件</span>
                </div>
              </div>

              {/* 操作平时收起，hover / 聚焦才出现；触屏常驻 */}
              <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => onDuplicate(p)}
                  aria-label={`复制 ${p.name}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-[#a8a49c] transition-colors duration-150 hover:bg-[#f2f0ec] hover:text-[#4b4945]"
                >
                  <IconCopy size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onRename(p)}
                  aria-label={`重命名 ${p.name}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-[#a8a49c] transition-colors duration-150 hover:bg-[#f2f0ec] hover:text-[#4b4945]"
                >
                  <IconEdit size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p)}
                  aria-label={`删除 ${p.name}`}
                  className="grid h-7 w-7 place-items-center rounded-md text-[#a8a49c] transition-colors duration-150 hover:bg-[#fdecea] hover:text-[#a4231a]"
                >
                  <IconTrash size={13} />
                </button>
              </div>
            </div>

            <ul className="mt-2.5 flex-1 space-y-1">
              {shown.map((it, i) => (
                <li key={`${it.productCode}-${i}`} className="flex items-baseline gap-1.5 text-[12px] text-[#4b4945]">
                  <span className="tnum w-5 shrink-0 text-right text-[10px] text-[#a8a49c]">{it.quantity}×</span>
                  <span className="truncate" title={it.name}>
                    {it.name}
                  </span>
                </li>
              ))}
              {rest > 0 ? <li className="pl-[26px] text-[11px] text-[#a8a49c]">还有 {rest} 项</li> : null}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2.5">
              <span className="flex min-w-0 items-center gap-1 text-[10px] text-[#a8a49c]">
                <IconStore size={11} />
                <span className="truncate" title={p.storeName}>
                  {p.storeName || p.storeCode}
                </span>
                <span className="shrink-0">· {fmtDate(p.updatedAt)}</span>
              </span>
              <button
                type="button"
                onClick={() => onUse(p)}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-[#f2f0ec] px-2 text-[11px] font-medium text-[#3d3a35] transition-colors duration-150 hover:bg-brand-500 hover:text-white active:scale-[0.97]"
              >
                <IconSparkle size={11} />
                用它
              </button>
            </div>
          </article>
        );
      })}

      {plans.length % 2 === 1 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e2dfd9] p-4 text-center">
          <span className="flex items-center gap-1 text-[12px] text-[#8a877f]">
            <IconPlus size={12} />
            还能再存一个
          </span>
          <span className="mt-1 text-[11px] leading-relaxed text-[#a8a49c]">下次调好之后点「存成常用方案」</span>
        </div>
      ) : null}
    </div>
  );
}
