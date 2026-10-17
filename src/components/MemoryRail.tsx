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

/**
 * 分组之间的分隔。深色区块里用「白色低透明」而不是灰线 ——
 * 灰线在黑底上会显脏，麦当劳的做法是纯白压到 18%。
 */
function Divider() {
  return <div className="my-5 h-[2px] w-full bg-white/18" aria-hidden="true" />;
}

/**
 * 「我记住的」—— 回答「你到底记住了我什么」。
 *
 * 顺序按记忆的精细度排：最常吃什么 → 套餐里最常选哪一格 → 我在什么时段吃。
 * 它放在**黑色区块**里（见 Overview）—— 深色是麦当劳次级信息的标准容器，
 * 反白能让这块「你的记忆」从白色卡片群里跳出来，且不需要额外描边。
 */
export function MemoryRail({ top, choices, buckets, activeBucket, loading, onPickBucket, onSeed }: MemoryRailProps) {
  const nonZero = buckets.filter((b) => b.count > 0).sort((a, b) => b.count - a.count);
  const zeroCount = buckets.length - nonZero.length;
  const maxCount = Math.max(...nonZero.map((b) => b.count), 1);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-44" />
        <Skeleton className="mt-4 h-9 w-full rounded-full bg-white/12" />
        <Skeleton className="h-9 w-full rounded-full bg-white/12" />
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
            <p className="display mt-3 text-[22px] leading-snug text-gold-400" title={top.name}>
              {top.name}
            </p>
            <p className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-white/70">
              <span className="tnum font-bold text-white">{top.count} 次</span>
              <span>出现在 {top.share}% 的订单里</span>
            </p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
              <div className="h-full rounded-full bg-gold-400" style={{ width: `${Math.min(top.share, 100)}%` }} />
            </div>
            <button
              type="button"
              onClick={() => onSeed(`再来一份${top.name}`)}
              className="group mt-4 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-500 px-4 text-[13px] font-black text-white shadow-brand-press transition-colors duration-100 hover:bg-brand-600 active:translate-y-[3px] active:shadow-none"
            >
              按这个点一单
              <IconArrow size={11} className="transition-transform duration-100 group-hover:translate-x-0.5" />
            </button>
          </>
        ) : (
          <p className="mt-3 text-[13px] leading-relaxed text-white/55">还没有可统计的餐品，先完成一单。</p>
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
                  <span className="min-w-0 truncate text-[13.5px] font-bold text-white" title={`${c.parentName} · ${c.name}`}>
                    {c.name}
                  </span>
                  <span className="tnum shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-bold text-white/80">
                    {c.count} 次
                  </span>
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
              className="text-[11.5px] font-bold text-gold-400 transition-colors duration-100 hover:text-gold-300"
            >
              清除筛选
            </button>
          ) : (
            <span className="text-[11.5px] text-white/45">点选可筛订单</span>
          )}
        </div>

        {nonZero.length === 0 ? (
          <p className="mt-3 text-[13px] leading-relaxed text-white/55">历史订单里没有可解析的下单时间。</p>
        ) : (
          <ul className="-mx-2 mt-2.5">
            {nonZero.map((b) => {
              const active = activeBucket === b.key;
              return (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => onPickBucket(active ? null : b.key)}
                    aria-pressed={active}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left transition-colors duration-100 ease-out',
                      active ? 'bg-brand-500 text-white' : 'hover:bg-white/10',
                    )}
                  >
                    <span className={cx('w-9 shrink-0 text-[13px] font-black', active ? 'text-white' : 'text-white/85')}>
                      {b.label}
                    </span>
                    <span className={cx('tnum w-10 shrink-0 text-[11.5px]', active ? 'text-white/80' : 'text-white/45')}>{b.range}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
                      <span
                        className={cx('block h-full rounded-full transition-all duration-150 ease-out', active ? 'bg-white' : 'bg-gold-400')}
                        style={{ width: `${Math.max((b.count / maxCount) * 100, 8)}%` }}
                      />
                    </span>
                    <span className="tnum w-5 shrink-0 text-right text-[13px] font-black text-white">{b.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {zeroCount > 0 && nonZero.length > 0 ? (
          <p className="mt-2.5 text-[11.5px] text-white/40">另 {zeroCount} 个时段没有订单</p>
        ) : null}
      </div>
    </div>
  );
}
