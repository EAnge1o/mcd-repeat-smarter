import type { Plan } from '../../server/domain/types';
import { IconArrow, IconCopy, IconEdit, IconTrash } from './Icons';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

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
  return (
    <div className="plan-card">
      <div className="plan-card__top">
        <button
          type="button"
          onClick={onUse}
          style={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'left' }}
          aria-label={`使用方案 ${plan.name}`}
        >
          <div className="plan-card__name">{plan.name}</div>
          <div className="plan-card__meta">
            {plan.tag ? `${plan.tag} · ` : ''}
            {timeAgo(plan.updatedAt)}
          </div>
        </button>

        <div className="plan-card__actions">
          <button type="button" className="icon-btn" onClick={onRename} title="重命名" aria-label="重命名">
            <IconEdit size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={onDuplicate} title="复制一份" aria-label="复制">
            <IconCopy size={14} />
          </button>
          <button type="button" className="icon-btn" onClick={onDelete} title="删除" aria-label="删除">
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      <div className="plan-card__items">
        {plan.items.slice(0, 4).map((item, i) => (
          <span key={`${item.productCode}-${i}`} className="item-pill">
            <span className="item-pill__qty">{item.quantity}×</span>
            {item.name}
            {item.children.length > 0 && (
              <span style={{ color: 'var(--ink-400)' }}>（{item.children.map((c) => c.name).join(' / ')}）</span>
            )}
          </span>
        ))}
        {plan.items.length > 4 && <span className="item-pill">+{plan.items.length - 4} 项</span>}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn--quiet" onClick={onUse}>
          用这个
          <IconArrow size={13} />
        </button>
      </div>
    </div>
  );
}
