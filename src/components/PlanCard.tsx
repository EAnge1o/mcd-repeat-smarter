import type { Plan } from '../../server/domain/types';
import { IconArrow, IconCopy, IconEdit, IconTrash } from './Icons';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚用过';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

/** 卡片上最多展示几项餐品，多出来的收成「还有 N 项」 */
const SHOWN = 3;

/**
 * 常用方案卡片。
 *
 * 信息顺序刻意做成「标签/时间 → 名字 → 餐品 → 数量/操作」，
 * 让用户一眼判断「这份是不是我要的」，而不是先读一堆元信息。
 * 操作按钮平时收起，悬停才出现，避免每张卡都长着一排图标。
 */
export function PlanCard({
  plan,
  onUse,
  onDuplicate,
  onDelete,
  onRename,
}: {
  plan: Plan;
  onUse: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const rest = plan.items.length - SHOWN;
  const totalQty = plan.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <article className="plan">
      <div className="plan__head">
        {/* 自动生成的方案名常常就等于分类名，重复两次会把卡片读成「加班夜宵 加班夜宵」 */}
        {plan.tag && plan.tag !== plan.name ? <span className="plan__tag">{plan.tag}</span> : null}
        <span className="plan__time">{timeAgo(plan.updatedAt)}</span>

        <div className="plan__tools">
          <button type="button" className="icon-btn" onClick={onRename} title="重命名" aria-label={`重命名 ${plan.name}`}>
            <IconEdit size={13} />
          </button>
          <button type="button" className="icon-btn" onClick={onDuplicate} title="复制一份" aria-label={`复制 ${plan.name}`}>
            <IconCopy size={13} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={onDelete}
            title="删除"
            aria-label={`删除 ${plan.name}`}
          >
            <IconTrash size={13} />
          </button>
        </div>
      </div>

      <h3 className="plan__name" title={plan.name}>
        {plan.name}
      </h3>

      <div className="plan__items">
        {plan.items.slice(0, SHOWN).map((item, i) => (
          <div key={`${item.productCode}-${i}`} className="plan__row">
            <span className="plan__qty">{item.quantity}×</span>
            <span className="plan__nm" title={item.name}>
              {item.name}
            </span>
            {item.children.length > 0 && (
              <span className="plan__kids" title={item.children.map((c) => c.name).join(' · ')}>
                {item.children.map((c) => c.name).join(' · ')}
              </span>
            )}
          </div>
        ))}
        {rest > 0 && <div className="plan__more">还有 {rest} 项</div>}
      </div>

      <div className="plan__foot">
        <span className="plan__count">共 {totalQty} 件</span>
        <button type="button" className="plan__use" onClick={onUse} aria-label={`使用方案 ${plan.name}`}>
          用这个方案
          <IconArrow size={12} />
        </button>
      </div>
    </article>
  );
}
