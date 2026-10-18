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

/**
 * 金额三态必须区分开：接口没返回（—）／券全额抵扣／正常金额。
 *
 * `paidYuan === "0"` 是接口真实返回的值（券或积分全额抵扣的单就是这样），
 * 不是数据缺失。所以不能画成「—」—— 那是撒谎说接口没给。
 * 但也不能只靠灰色区分：这个账号的 10 单里有 6 单是 0 元，
 * 只降权颜色的话，满屏灰 ¥0.00 看起来像页面坏了。加「券」字才说得清。
 */
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
    <span className="inline-flex items-baseline gap-1">
      <span
        className={cx(
          'tnum font-black',
          c === 0 ? 'text-ink-faint' : 'text-ink',
          size === 'lg' ? 'text-[22px]' : 'text-[17px]',
        )}
      >
        ¥{yuan(c)}
      </span>
      {c === 0 ? (
        <span
          className="rounded bg-gold-400 px-1 text-[10px] font-black leading-[1.5] text-ink"
          title="这一单由券或积分全额抵扣，实付为 0"
        >
          券
        </span>
      ) : null}
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

  /**
   * 按「年-月」分组。分组标题只在跨月时出现，不重复渲染。
   *
   * key 必须带上序号：按金额排序后同一个月会被切成两段（比如 7 月有两单一多一少），
   * 只用「2026年7月」当 key 会撞车，React 复用错节点，展开态会串到别的行上。
   */
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: HistoryOrder[] }[] = [];
    for (const o of rows) {
      const d = new Date(o.createTime);
      const label = Number.isNaN(d.getTime()) ? '未知' : `${d.getFullYear()}年${d.getMonth() + 1}月`;
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(o);
      else out.push({ key: `${label}-${out.length}`, label, items: [o] });
    }
    return out;
  }, [rows]);

  if (loading) {
    return (
      <div className="space-y-4 py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-2 ring-ink/10">
            <Skeleton className="h-9 w-14 rounded-full" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-2.5 h-3 w-1/4" />
            </div>
            <Skeleton className="h-5 w-16" />
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-3 pb-5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-[320px]">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute">
              <IconSearch size={16} />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜门店、餐品或订单号"
              aria-label="搜索订单"
              className="h-11 w-full rounded-full bg-white pl-11 pr-4 text-[13.5px] font-medium text-ink ring-2 ring-ink/15 transition-shadow duration-100 placeholder:font-normal placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-ink/40"
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
                  'rounded-full px-4 py-2 text-[13px] font-bold transition-colors duration-100',
                  sort === s.key
                    ? 'bg-ink text-white shadow-[0_3px_0_rgba(13,13,13,0.28)] active:translate-y-[2px] active:shadow-none'
                    : 'bg-white text-ink-mute ring-2 ring-ink/12 hover:bg-gold-100 hover:text-ink',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          <p className="tnum rounded-full bg-ink/6 px-3.5 py-2 text-[13px] font-bold text-ink-mute">
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
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-bold text-white transition-colors duration-100 hover:bg-ink-soft"
            >
              清空搜索
            </button>
          }
        />
      ) : (
        <div>
          {groups.map((g, gi) => {
            // 同一个月份可能被排序切成两段（下面那段不接在上面），加序号避免读者以为重复渲染
            const twin = groups.findIndex((x) => x.label === g.label) !== gi;
            return (
            <section key={g.key} className="mb-7 last:mb-0">
              <h3
                className={cx(
                  'display display-12 -mx-1 mb-3 mt-2 inline-block rounded-full bg-ink px-4 py-1.5 text-gold-400',
                  stickyMonths && 'sticky top-16 z-10',
                )}
              >
                {g.label}
                {twin ? ` · 续 ${groups.filter((x) => x.label === g.label).indexOf(g) + 1}` : ''}
              </h3>

              <ul className="space-y-2.5">
                {g.items.map((o) => {
                  const open = openId === o.orderId;
                  const pieces = o.items.reduce((n, i) => n + i.quantity, 0);

                  return (
                    <li
                      key={o.orderId}
                      className={cx(
                        'overflow-hidden rounded-2xl bg-white ring-2 transition-shadow duration-100',
                        open ? 'shadow-[0_4px_0_rgba(13,13,13,0.16)] ring-ink/20' : 'shadow-[0_2px_0_rgba(13,13,13,0.1)] ring-ink/12 hover:shadow-[0_3px_0_rgba(13,13,13,0.14)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggle(o.orderId)}
                        aria-expanded={open}
                        aria-controls={`order-detail-${o.orderId}`}
                        className={cx(
                          'group grid w-full grid-cols-[3.5rem_minmax(0,1fr)_auto] items-start gap-x-4 px-4 py-4 text-left',
                          'transition-colors duration-100 ease-out md:grid-cols-[4.5rem_minmax(0,1fr)_auto] md:gap-x-6',
                          open ? 'bg-ink/4' : 'hover:bg-gold-100',
                        )}
                      >
                        {/* 时间：最轻的一列。两行放得下月日和时分，不必挤成一行 */}
                        <span className="tnum rounded-full bg-ink px-2.5 py-1.5 text-center text-[11.5px] font-bold leading-[1.4] text-white">
                          <span className="block">{fmtDateTime(o.createTime).split(' ')[0]}</span>
                          <span className="block text-gold-400">{fmtDateTime(o.createTime).split(' ')[1]}</span>
                        </span>

                        {/* 餐品：主角。不截断 —— 认不出点了什么，这一行就等于没信息 */}
                        <span className="min-w-0">
                          <span className="block text-[15px] font-bold leading-[1.6] text-ink">
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
                          <span className="mt-1.5 block truncate text-[13px] text-ink-mute">
                            {o.storeName || o.storeCode}
                            <span className="px-1.5 text-ink-faint">·</span>
                            <span className="tnum font-bold text-ink-faint">{pieces} 件</span>
                          </span>
                        </span>

                        {/* 金额 + 展开提示 */}
                        <span className="flex shrink-0 items-center gap-2 pt-0.5">
                          <Amount order={o} />
                          <span
                            className={cx(
                              'grid h-7 w-7 place-items-center rounded-full bg-ink/6 text-ink-mute transition-transform duration-150 ease-out group-hover:bg-ink group-hover:text-white',
                              open ? 'rotate-180 bg-ink text-white' : '',
                            )}
                            aria-hidden="true"
                          >
                            <IconChevronDown size={14} />
                          </span>
                        </span>
                      </button>

                      {open ? (
                        <div id={`order-detail-${o.orderId}`} className="animate-fade-in border-t-2 border-ink/10 bg-gold-100/50 px-4 pb-5 pt-4 md:px-5">
                          <div className="grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,1fr)_auto]">
                            <ul className="min-w-0 space-y-2">
                              {o.items.map((it, i) => (
                                <li key={`${o.orderId}-detail-${it.productCode}-${i}`}>
                                  <p className="flex items-baseline gap-3 text-[14px] font-bold leading-[1.7] text-ink">
                                    <span className="tnum w-7 shrink-0 rounded-full bg-brand-500 px-1.5 py-0.5 text-center text-[11.5px] font-black text-white">
                                      {it.quantity}×
                                    </span>
                                    <span className="min-w-0 flex-1">{it.name}</span>
                                  </p>
                                  {it.children.length > 0 ? (
                                    <p className="mt-1 pl-[38px] text-[13px] leading-relaxed text-ink-mute">
                                      {it.children
                                        .map((c) => `${c.roundName ? `${c.roundName} · ` : ''}${c.name}`)
                                        .join(' / ')}
                                    </p>
                                  ) : null}
                                </li>
                              ))}
                            </ul>

                            <dl className="space-y-2 text-[13px] md:w-[200px]">
                              {[
                                ['门店', o.storeName || o.storeCode],
                                ['取餐方式', BE_TYPE_LABEL[o.beType] ?? '—'],
                                ['状态', o.orderStatus || '未知'],
                                ['订单号', o.orderId],
                              ].map(([k, v]) => (
                                <div key={k} className="flex gap-3">
                                  <dt className="shrink-0 text-ink-faint">{k}</dt>
                                  <dd
                                    className={cx('min-w-0 flex-1 truncate font-bold text-ink', k === '订单号' && 'code text-[11.5px] font-medium text-ink-soft')}
                                    title={v}
                                  >
                                    {v}
                                  </dd>
                                </div>
                              ))}
                              <div className="flex gap-3 border-t-2 border-ink/10 pt-2.5">
                                <dt className="shrink-0 text-ink-faint">实付</dt>
                                <dd>
                                  <Amount order={o} size="lg" />
                                </dd>
                              </div>
                            </dl>
                          </div>

                          {onUse ? (
                            <div className="mt-5 pl-0 md:pl-[38px]">
                              <button
                                type="button"
                                onClick={() => onUse(o)}
                                className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-500 px-5 text-[13.5px] font-black text-white shadow-brand-press transition-colors duration-100 hover:bg-brand-600 active:translate-y-[3px] active:shadow-none"
                              >
                                <IconRefresh size={13} />
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
            );
          })}
        </div>
      )}
    </div>
  );
}
