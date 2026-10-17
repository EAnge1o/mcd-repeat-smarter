import type { HabitProfile } from '../../server/domain/types';
import { IconClock, IconHistory } from './Icons';

/**
 * 习惯摘要：所有数字都来自 MCP 真实历史订单统计。
 * 样本为空时只展示引导，不假装认识用户。
 */
export function HabitBar({ habit }: { habit: HabitProfile }) {
  if (habit.sampleSize === 0) {
    return (
      <div className="habit">
        <span className="habit__pill">
          <IconHistory size={14} />
          还没有历史订单
        </span>
        <span className="habit__pill" style={{ color: 'var(--ink-400)' }}>
          先手动挑一份存成「老样子」，之后一句话就能改
        </span>
      </div>
    );
  }

  const main = habit.topItems[0];
  const child = habit.topChildren[0];

  return (
    <div className="habit">
      <span className="habit__pill habit__pill--accent">
        <IconHistory size={14} />
        近 {habit.sampleSize} 单
      </span>

      {main && (
        <span className="habit__pill">
          <span className="habit__num">{main.count}</span>
          {main.name}
        </span>
      )}

      {child && (
        <span className="habit__pill">
          <span className="habit__num">{child.count}</span>
          常配{child.name}
        </span>
      )}

      {habit.topHour && (
        <span className="habit__pill">
          <IconClock size={13} />
          多在{habit.topHour.label}下单
        </span>
      )}

      {habit.topStore && habit.topStore.count === habit.sampleSize && (
        <span className="habit__pill" style={{ maxWidth: 260 }}>
          <IconHistory size={13} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{habit.topStore.storeName}</span>
        </span>
      )}
    </div>
  );
}
