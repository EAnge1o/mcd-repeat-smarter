import type { HabitProfile } from '../../server/domain/types';

/**
 * 习惯摘要。
 *
 * 所有数字都来自 MCP 真实历史订单统计，不是编的。
 * 呈现为一行「事实」而不是四个卡片格：首屏最贵的是纵向空间，
 * 四张数据卡会把标题和输入区推下去，也会让页面看起来像后台看板。
 * 每条只保留「一句话能读完」的量 —— 宁少勿挤。
 */
export function HabitBar({ habit }: { habit: HabitProfile }) {
  if (habit.sampleSize === 0) {
    return (
      <div className="facts">
        <div className="facts__item">
          <span className="facts__value">还没有可读的历史订单</span>
          <span className="facts__label">先挑一份存成常用方案</span>
        </div>
      </div>
    );
  }

  const main = habit.topItems[0];

  return (
    <div className="facts">
      <div className="facts__item">
        <span className="facts__value num">{habit.sampleSize}</span>
        <span className="facts__label">单历史</span>
      </div>

      {main && (
        <div className="facts__item" title={`${main.name} · 点过 ${main.count} 次`}>
          <span className="facts__label">常点</span>
          <span className="facts__value">{main.name}</span>
          <span className="facts__label num">×{main.count}</span>
        </div>
      )}

      {habit.topHour && (
        <div className="facts__item">
          <span className="facts__label">最常在</span>
          <span className="facts__value">{habit.topHour.label}</span>
        </div>
      )}
    </div>
  );
}
