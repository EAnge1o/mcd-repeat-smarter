import { useMemo, useState } from 'react';
import type { HistoryOrder } from '../../server/domain/types';
import { BE_TYPE_LABEL } from '../../server/domain/types';
import { EmptyState, Skeleton, cx } from './ui';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';
import { IconChevronDown, IconRefresh, IconSearch } from './Icons';

interface OrdersTableProps {
  orders: HistoryOrder[];
  loading?: boolean;
  onUse?: (order: HistoryOrder) => void;
  /** 概览页只显示前几行，完整列表在「订单记录」页 */
  limit?: number;
  emptyAction?: React.ReactNode;
  /** 显示搜索与排序控件 */
  controls?: boolean;
  /**
   * 受控展开。概览页点趋势图要定位并展开指定那一单，
   * 所以展开态既可以由组件自己管，也可以由外面指定。
   */
  openId?: string | null;
  onToggle?: (id: string) => void;
  /** 每月分组的标题是否吸顶。列表独立成页时不需要（会跟顶栏打架） */
  stickyMonths?: boolean;
}

/** 金额三态必须区分开：接口没返回（—）／券全额抵扣（¥0.00 降权显示）／正常金额。 */
function Amount({ order, size = 'md' }: { order: HistoryOrder; size?: 'md' | 'lg' }) {
  const c = paidCents(order);
  if (c === null) {
    return (
      <span className="tnum text-ink-faint" title="接口未返回实付金额">
        —
      </span>
    );
  }
  return (
    <span className={cx('tnum display', c === 0 ? 'text-ink-faint' : 'text-ink', size === 'lg' ? 'text-[17px]' : 'text-[15px]')}>
      ¥{yuan(c)}
    </span>
  );
}

type SortKey = 'time' | 'amount';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'time', label: '按时间' },
  { key: 'amount', label: '按金额' },
];

/**
 * 订单列表。
 *
 * **不是后台表格。** 表格适合逐列比对，但这里的任务是「认出某一单，然后复用它」，
 * 所以改成刊物式的清单：
 * - 月份做视觉分组，一组几行，扫一眼就知道哪个月花得多；
 * - 餐品名是主角，不截断成一行 —— 关键信息被省略号吃掉等于没有；
 * - 金额右对齐并对齐小数位，方便纵向比较；
 * - 点一行就地展开完整明细，不跳页。
 *
 * 搜索与排序都是真逻辑：搜索同时命中门店、餐品、订单号；排序是稳定排序，
 * 金额为「—」的单一律沉到末尾，而不是被当成 0 排到最前面。
 */
export function OrdersTable({
  orders,
  loading,
  onUse,
  limit,
  emptyAction,
  controls = false,
  openId: openIdProp,
  onToggle,
  stickyMonths = false,
}: OrdersTableProps) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('time');
  const [ownOpenId, setOwnOpenId] = useState<string | null>(null);
  const openId = openIdProp !== undefined ? openIdProp : ownOpenId;
  const toggle = (id: string) => {
    setOwnOpenId((cur) => (cur === id ? null : id));
    onToggle?.(id);
  };

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return orders;
    return orders.filter((o) =>
      `${o.storeName} ${o.orderId} ${o.orderStatus} ${o.items.map((i) => i.name).join(' ')}`
        .toLowerCase()
        .includes(key),
    );
  }, [orders, q]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sort === 'time') {
      return list.sort((a, b) => b.createTime.localeCompare(a.createTime));
    }
    // 金额为「—」的沉底：把它们当成 0 排到最前，会让人以为这些单是免费的
    return list.sort((a, b) => {
      const ca = paidCents(a);
      const cb = paidCents(b);
      if (ca === null && cb === null) return b.createTime.localeCompare(a.createTime);
      if (ca === null) return 1;
      if (cb === null) return -1;
      return cb - ca || b.createTime.localeCompare(a.createTime);
    });
  }, [filtered, sort]);

  const rows = limit ? sorted.slice(0, limit) : sorted;

  /** 按「年-月」分组。分组标题只在跨月时出现，不重复渲染。 */
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: HistoryOrder[] }[] = [];
    for (const o of rows) {
      const d = new Date(o.createTime);
      const key = Number.isNaN(d.getTime()) ? '未知' : `${d.getFullYear()}年${d.getMonth() + 1}月`;
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(o);
      else out.push({ key, label: key, items: [o] });
    }
    return out;
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-4 py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-3 w-14" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="mt-2 h-2.5 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return <EmptyState title="还没有历史订单" desc="完成一单后，这里会显示门店、餐品与实付金额。" action={emptyAction} />;
  }

  return (
    <div>
      {/* 控件区：搜索 + 排序。只有真的能筛、能排才放出来 */}
      {controls ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-4">
          <div className="relative min-w-[200px] flex-1 sm:max-w-[280px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
              <IconSearch size={14} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜门店、餐品或订单号"
              aria-label="搜索订单"
              className="h-9 w-full rounded-lg bg-white pl-9 pr-3 text-[12.5px] text-ink ring-1 ring-inset ring-line transition-colors duration-150 placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-brand-400"
            />
          </div>

          <div className="flex items-center gap-1" role="group" aria-label="排序方式">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSort(s.key)}
                aria-pressed={sort === s.key}
                className={cx(
                  'rounded-md px-2.5 py-1.5 text-[12px] transition-colors duration-150',
                  sort === s.key ? 'bg-ink text-white' : 'text-ink-mute hover:bg-wash hover:text-ink',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="tnum text-[11.5px] text-ink-mute">
            {q.trim() ? `${sorted.length} / ${orders.length} 单` : `共 ${orders.length} 单`}
          </p>
        </div>
      ) : null}

      {sorted.length === 0 && q.trim() ? (
        <EmptyState
          compact
          title="没有匹配的订单"
          desc={`「${q.trim()}」在 ${orders.length} 单里没有命中。换个关键词，或者清空搜索框。`}
          action={
            <button
              type="button"
              onClick={() => setQ('')}
              className="rounded-md px-3 py-1.5 text-[12px] text-ink-mute transition-colors duration-150 hover:bg-wash hover:text-ink"
            >
              清空搜索
            </button>
          }
        />
      ) : (
        <div>
          {groups.map((g) => (
            <section key={g.key} className="mb-2 last:mb-0">
              <h3 className={cx('eyebrow -mx-1 px-1 py-2', stickyMonths && 'sticky top-14 z-10 bg-canvas/95 backdrop-blur-sm')}>
                {g.label}
              </h3>

              <ul>
                {g.items.map((o) => {
                  const open = openId === o.orderId;
                  const pieces = o.items.reduce((n, i) => n + i.quantity, 0);

                  return (
                    <li key={o.orderId} className="border-b border-hair last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggle(o.orderId)}
                        aria-expanded={open}
                        aria-controls={`order-detail-${o.orderId}`}
                        className={cx(
                          'group grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-4 px-2 py-3.5 text-left',
                          'transition-colors duration-150 ease-out md:grid-cols-[4.5rem_minmax(0,1fr)_auto] md:gap-x-6',
                          open ? 'bg-wash' : 'hover:bg-wash',
                        )}
                      >
                        {/* 时间：最轻的一列。两行放得下月日和时分，不必挤成一行 */}
                        <span className="tnum pt-0.5 text-[11.5px] leading-[1.45] text-ink-faint">
                          <span className="block">{fmtDateTime(o.createTime).split(' ')[0]}</span>
                          <span className="block">{fmtDateTime(o.createTime).split(' ')[1]}</span>
                        </span>

                        {/* 餐品：主角。不截断 —— 认不出点了什么，这一行就等于没信息 */}
                        <span className="min-w-0">
                          <span className="block text-[13.5px] leading-[1.65] text-ink">
                            {o.items.length === 0 ? (
                              <span className="text-ink-faint">（无明细）</span>
                            ) : (
                              o.items.map((i, idx) => (
                                <span key={`${o.orderId}-${i.productCode}-${idx}`}>
                                  {idx > 0 ? <span className="text-ink-faint">、</span> : null}
                                  <span className={i.quantity > 1 ? 'text-ink' : undefined}>{i.name}</span>
                                  {i.quantity > 1 ? (
                                    <span className="tnum text-ink-mute"> ×{i.quantity}</span>
                                  ) : null}
                                </span>
                              ))
                            )}
                          </span>
                          <span className="mt-1 block truncate text-[11.5px] text-ink-faint">
                            {o.storeName || o.storeCode}
                            <span className="px-1.5">·</span>
                            <span className="tnum">{pieces} 件</span>
                          </span>
                        </span>

                        {/* 金额 + 展开提示 */}
                        <span className="flex shrink-0 items-center gap-2 pt-0.5">
                          <Amount order={o} />
                          <span
                            className={cx(
                              'text-ink-faint transition-transform duration-150 ease-out group-hover:text-ink-mute',
                              open ? 'rotate-180' : '',
                            )}
                            aria-hidden="true"
                          >
                            <IconChevronDown size={14} />
                          </span>
                        </span>
                      </button>

                      {open ? (
                        <div id={`order-detail-${o.orderId}`} className="animate-fade-in bg-wash px-2 pb-4 pt-1 md:px-3">
                          <div className="grid gap-x-10 gap-y-4 md:grid-cols-[minmax(0,1fr)_auto]">
                            <ul className="min-w-0 space-y-2">
                              {o.items.map((it, i) => (
                                <li key={`${o.orderId}-detail-${it.productCode}-${i}`}>
                                  <p className="flex items-baseline gap-2.5 text-[12.5px] leading-[1.7] text-ink">
                                    <span className="tnum w-6 shrink-0 text-right text-[11.5px] text-ink-faint">
                                      {it.quantity}×
                                    </span>
                                    <span className="min-w-0 flex-1">{it.name}</span>
                                  </p>
                                  {it.children.length > 0 ? (
                                    <p className="mt-0.5 pl-[34px] text-[11.5px] leading-relaxed text-ink-mute">
                                      {it.children
                                        .map((c) => `${c.roundName ? `${c.roundName} · ` : ''}${c.name}`)
                                        .join(' / ')}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>

                            <dl className="space-y-1.5 text-[11.5px] md:w-[190px]">
                              {[
                                ['门店', o.storeName || o.storeCode],
                                ['取餐方式', BE_TYPE_LABEL[o.beType] ?? '—'],
                                ['状态', o.orderStatus || '未知'],
                                ['订单号', o.orderId],
                              ].map(([k, v]) => (
                                <div key={k} className="flex gap-3">
                                  <dt className="shrink-0 text-ink-faint">{k}</dt>
                                  <dd
                                    className={cx('min-w-0 flex-1 truncate text-ink-soft', k === '订单号' && 'code text-[11px]')}
                                    title={v}
                                  >
                                    {v}
                                  </dd>
                                </div>
                              ))}
                              <div className="flex gap-3 pt-1">
                                <dt className="shrink-0 text-ink-faint">实付</dt>
                                <dd>
                                  <Amount order={o} size="lg" />
                                </dd>
                              </div>
                            </dl>
                          </div>

                          {onUse ? (
                            <div className="mt-4 pl-0 md:pl-[34px]">
                              <button
                                type="button"
                                onClick={() => onUse(o)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3.5 text-[12px] font-medium text-ink-soft ring-1 ring-inset ring-line transition-[background-color,color] duration-150 ease-out hover:bg-ink hover:text-white active:scale-[0.98]"
                              >
                                <IconRefresh size={12} />
                                照这一单再来
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
