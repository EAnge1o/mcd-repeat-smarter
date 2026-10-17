import type { Bucket, Choice } from '../lib/metrics';
import { Skeleton, cx } from './ui';
import { IconArrow } from './Icons';

interface MemoryRailProps {
  top: { name: string; count: number; share: number } | null;
  choices: Choice[];
  avg: { value: string; hint: string };
  total: { value: string; unit?: string; hint: string };
  buckets: Bucket[];
  activeBucket: string | null;
  loading: boolean;
  onPickBucket: (key: string | null) => void;
  /** 把一句话填进主舞台的输入框 */
  onSeed: (text: string) => void;
}

/** 每段在宽屏用发丝线分隔；在 640–1279 之间收成 2–4 列横排，避免窄栏被拉成一条长带 */
const SEG = 'xl:mt-4 xl:border-t xl:border-line xl:pt-4';

/**
 * 右侧注解栏 —— 回答「你到底记住了我什么」。
 *
 * 顺序按记忆的精细度排：最常吃什么 → 套餐里最常选哪一格 → 我的消费节奏 → 我在什么时段吃。
 * 刻意不包卡片：四段靠发丝线分隔，读起来是一条注解，而不是四块面板。
 */
export function MemoryRail({ top, choices, avg, total, buckets, activeBucket, loading, onPickBucket, onSeed }: MemoryRailProps) {
  const nonZero = buckets.filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
  const zeroCount = buckets.length - nonZero.length;
  const maxCount = Math.max(...nonZero.map((b) => b.count), 1);

  return (
    <aside aria-labelledby="rail-title">
      <h2 id="rail-title" className="text-[13px] font-semibold tracking-tight text-[#111827]">
        我记住的
      </h2>

      {loading ? (
        <div className="mt-4 space-y-2.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-5 h-3 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <div className="mt-3.5 grid gap-y-5 sm:grid-cols-2 sm:gap-x-8 xl:mt-0 xl:block xl:gap-x-0">
          {/* 段 1：最常点 —— 唯一一段带主动作的 */}
          <div>
            <p className="text-[11.5px] text-[#6f6a62]">最常点</p>
            {top ? (
              <>
                <p className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-[#111827]" title={top.name}>
                  {top.name}
                </p>
                <p className="mt-1 flex items-baseline gap-1.5 text-[11.5px] text-[#6f6a62]">
                  <span className="tnum text-[#57534c]">{top.count} 次</span>
                  <span aria-hidden="true">·</span>
                  <span>出现在 {top.share}% 的订单里</span>
                </p>
                <div className="mt-2.5 h-[3px] w-full bg-[#f0eee9]" aria-hidden="true">
                  <div className="h-full bg-brand-500" style={{ width: `${Math.min(top.share, 100)}%` }} />
                </div>
                <button
                  type="button"
                  onClick={() => onSeed(`再来一份${top.name}`)}
                  className="group mt-2.5 inline-flex items-center gap-1 rounded-md py-0.5 text-[11.5px] font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
                >
                  按这个点一单
                  <IconArrow size={11} className="transition-transform duration-150 group-hover:translate-x-0.5" />
                </button>
              </>
            ) : (
              <p className="mt-1.5 text-[12px] leading-relaxed text-[#6f6a62]">还没有可统计的餐品，先完成一单。</p>
            )}
          </div>

          {/* 段 2：套餐里最常选的那一格。没有 children 数据就整段不出现，不放空标题 */}
          {choices.length > 0 ? (
            <div className={SEG}>
              <p className="text-[11.5px] text-[#6f6a62]">套餐里最常选</p>
              <ul className="mt-1.5 space-y-1">
                {choices.map((c) => (
                  <li key={c.name} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-[12px] text-[#3d3a35]" title={`${c.parentName} · ${c.name}`}>
                      {c.name}
                    </span>
                    <span className="tnum shrink-0 text-[11px] text-[#6f6a62]">{c.count} 次</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* 段 3：两个数字。不加环比箭头 —— 上一窗口常没有样本，硬算出来的百分比是假的 */}
          <dl className={cx('flex gap-7', SEG)}>
            <div className="min-w-0">
              <dt className="text-[11.5px] text-[#6f6a62]">平均客单价</dt>
              <dd className="tnum mt-1 text-[19px] font-semibold leading-none tracking-tight text-[#111827]">{avg.value}</dd>
              <p className="mt-1.5 truncate text-[10.5px] text-[#6f6a62]" title={avg.hint}>
                {avg.hint}
              </p>
            </div>
            <div className="min-w-0">
              <dt className="text-[11.5px] text-[#6f6a62]">累计下单</dt>
              <dd className="mt-1 flex items-baseline gap-1">
                <span className="tnum text-[19px] font-semibold leading-none tracking-tight text-[#111827]">{total.value}</span>
                {total.unit ? <span className="text-[10.5px] text-[#6f6a62]">{total.unit}</span> : null}
              </dd>
              <p className="mt-1.5 truncate text-[10.5px] text-[#6f6a62]" title={total.hint}>
                {total.hint}
              </p>
            </div>
          </dl>

          {/* 段 4：时段。只列有单的时段，点一下就筛下面的订单列表 */}
          <div className={SEG}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[11.5px] text-[#6f6a62]">下单时段</p>
              {activeBucket ? (
                <button
                  type="button"
                  onClick={() => onPickBucket(null)}
                  className="rounded text-[11px] font-medium text-[#57534c] transition-colors duration-150 hover:text-brand-600"
                >
                  清除筛选
                </button>
              ) : (
                <span className="text-[10.5px] text-[#6f6a62]">点选可筛订单</span>
              )}
            </div>

            {nonZero.length === 0 ? (
              <p className="mt-2 text-[11.5px] leading-relaxed text-[#6f6a62]">历史订单里没有可解析的下单时间。</p>
            ) : (
              <ul className="mt-1.5 space-y-0.5">
                {nonZero.map((b) => {
                  const active = activeBucket === b.key;
                  return (
                    <li key={b.key}>
                      <button
                        type="button"
                        onClick={() => onPickBucket(active ? null : b.key)}
                        aria-pressed={active}
                        className={cx(
                          '-mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors duration-150 ease-out',
                          active ? 'bg-brand-50' : 'hover:bg-[#faf9f7]',
                        )}
                      >
                        <span className={cx('w-7 shrink-0 text-[12px]', active ? 'font-medium text-brand-700' : 'text-[#4b4945]')}>
                          {b.label}
                        </span>
                        <span className="tnum w-9 shrink-0 text-[10px] text-[#6f6a62]">{b.range}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-[2px] bg-[#f2f0ec]" aria-hidden="true">
                          <span
                            className={cx('block h-full rounded-[2px] transition-all duration-200 ease-out', active ? 'bg-brand-500' : 'bg-[#e2665a]')}
                            style={{ width: `${Math.max((b.count / maxCount) * 100, 8)}%` }}
                          />
                        </span>
                        <span className="tnum w-3 shrink-0 text-right text-[11.5px] text-[#111827]">{b.count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {zeroCount > 0 && nonZero.length > 0 ? (
              <p className="mt-1.5 text-[10.5px] text-[#6f6a62]">另 {zeroCount} 个时段没有订单</p>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
}
