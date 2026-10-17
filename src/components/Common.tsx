import type { ReactNode } from 'react';
import { IconAlert, IconInfo } from './Icons';

export function SourceBadge({ mode }: { mode: 'live' | 'demo' }) {
  if (mode === 'demo') {
    return (
      <span className="badge badge--demo" title="当前没有连接真实 MCP，页面展示的是内置演示数据">
        <span className="dot" />
        演示数据
      </span>
    );
  }
  return (
    <span className="badge badge--live" title="数据来自麦当劳 MCP 实时返回">
      <span className="dot" />
      实时数据
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'exact':
      return <span className="badge badge--ok">仍可点</span>;
    case 'renamed':
      return <span className="badge badge--warn">编码已更新</span>;
    case 'substituted':
      return <span className="badge badge--warn">已替换</span>;
    case 'unavailable':
      return <span className="badge badge--red">已下架</span>;
    default:
      return <span className="badge badge--muted">{status}</span>;
  }
}

export function Alert({
  kind,
  title,
  children,
  hint,
}: {
  kind: 'error' | 'warn' | 'info';
  title?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      {kind === 'info' ? <IconInfo /> : <IconAlert />}
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        <div>{children}</div>
        {hint && <div className="alert__hint">{hint}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon?: ReactNode;
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <div className="empty__title">{title}</div>
      {desc && <div className="empty__desc">{desc}</div>}
      {action}
    </div>
  );
}

export function LoadingBlock({ text = '正在向麦当劳 MCP 查询…' }: { text?: string }) {
  return (
    <div className="loading-block">
      <div className="spinner spinner--dark" />
      <span>{text}</span>
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 18 : 13, width: `${[92, 74, 58][i % 3]}%` }} />
      ))}
    </div>
  );
}

export interface ToastItem {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

export function Toasts({ items }: { items: ToastItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="toast-wrap" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.kind === 'error' ? ' toast--error' : ''}`}>
          {t.kind === 'error' ? <IconAlert size={15} /> : null}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
