import type { Bucket, Choice } from '../lib/metrics';
import { Skeleton, cx } from './ui';
import { IconArrow } from './Icons';

interface MemoryRailProps {
  top: { name: string; count: number; share: number } | null;
  choices: Choice[];
  buckets: Bucket[];
  activeBucket: string | null;
  loading: boolean;
  onPickBucket: (key: string | null) => void;
  /** 把一句话填进主舞台的输入框 */
  onSeed: (text: string) => void;
}

/** 分组之间的分隔：一条两端淡出的发丝线 */
function Divider() {
  return <div className="hair my-5" aria-hidden="true" />;
}

/**
 * 「我记住的」—— 回答「你到底记住了我什么」。
 *
 * 顺序按记忆的精细度排：最常吃什么 → 套餐里最常选哪一格 → 我在什么时段吃。
 * 这里刻意不做成四张统计卡：它是一段连续的注解，靠发丝线断句，
 * 每一段都允许点 —— 要么填进输入框，要么筛下面的订单。
 */
export function MemoryRail({ top, choices, buckets, activeBucket, loading, onPickBucket, onSeed }: MemoryRailProps) {
  const nonZero = buckets.filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
  const zeroCount = buckets.length - nonZero.length;
  const maxCount = Math.max(...nonZero.map((b) => b.count), 1);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-4 h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  return (
    <div>
      {/* 段 1：最常点 —— 唯一一段带主动作 */}
      <div>
        <p className="eyebrow">最常点</p>
        {top ? (
          <>
            <p className="display mt-2.5 text-[19px] leading-snug text-ink" title={top.name}>
              {top.name}
            </p>
            <p className="mt-1.5 flex items-baseline gap-1.5 text-[11px] text-ink-mute">
              <span className="tnum text-ink-soft">{top.count} 次</span>
              <span className="text-[#d5cec6]">·</span>
              <span>出现在 {top.share}% 的订单里</span>
            </p>
            <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#eee8e2]" aria-hidden="true">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(top.share, 100)}%` }} />
            </div>
            <button
              type="button"
              onClick={() => onSeed(`再来一份${top.name}`)}
              className="group mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 transition-colors duration-200 hover:text-brand-700"
            >
              按这个点一单
              <IconArrow size={10} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </>
        ) : (
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">还没有可统计的餐品，先完成一单。</p>
        )}
      </div>

      {/* 段 2：套餐里最常选的那一格。没有 children 数据就整段不出现，不放空标题 */}
      {choices.length > 0 ? (
        <>
          <Divider />
          <div>
            <p className="eyebrow">套餐里最常选</p>
            <ul className="mt-2.5 space-y-1.5">
              {choices.map((c) => (
                <li key={c.name} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12.5px] text-ink-soft" title={`${c.parentName} · ${c.name}`}>
                    {c.name}
                  </span>
                  <span className="tnum shrink-0 text-[10px] text-ink-faint">{c.count} 次</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {/* 段 3：时段。只列有单的时段，点一下就筛下面的订单 */}
      <Divider />
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="eyebrow">下单时段</p>
          {activeBucket ? (
            <button
              type="button"
              onClick={() => onPickBucket(null)}
              className="text-[10.5px] font-medium text-ink-soft transition-colors duration-200 hover:text-brand-600"
            >
              清除筛选
            </button>
          ) : (
            <span className="text-[10px] text-ink-faint">点选可筛订单</span>
          )}
        </div>

        {nonZero.length === 0 ? (
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">历史订单里没有可解析的下单时间。</p>
        ) : (
          <ul className="mt-2 -mx-2">
            {nonZero.map((b) => {
              const active = activeBucket === b.key;
              return (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => onPickBucket(active ? null : b.key)}
                    aria-pressed={active}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors duration-200 ease-out',
                      active ? 'bg-brand-50' : 'hover:bg-[#f8f4f0]',
                    )}
                  >
                    <span className={cx('w-8 shrink-0 text-[12px]', active ? 'font-medium text-brand-700' : 'text-ink-soft')}>
                      {b.label}
                    </span>
                    <span className="tnum w-9 shrink-0 text-[9.5px] text-ink-faint">{b.range}</span>
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-[#eee8e2]" aria-hidden="true">
                      <span
                        className={cx('block h-full rounded-full transition-all duration-300 ease-out', active ? 'bg-brand-500' : 'bg-[#d9a29a]')}
                        style={{ width: `${Math.max((b.count / maxCount) * 100, 8)}%` }}
                      />
                    </span>
                    <span className="tnum w-4 shrink-0 text-right text-[10px] text-ink">{b.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {zeroCount > 0 && nonZero.length > 0 ? (
          <p className="mt-2 text-[10px] text-ink-faint">另 {zeroCount} 个时段没有订单</p>
        ) : null}
      </div>
    </div>
  );
}
