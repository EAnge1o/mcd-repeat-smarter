import type { Plan } from '../../server/domain/types';
import { cx } from './ui';
import {
  IconArches,
  IconBookmark,
  IconChevronRight,
  IconClose,
  IconGrid,
  IconInfo,
  IconReceipt,
  IconSparkle,
  IconStore,
} from './Icons';

export type ViewKey = 'overview' | 'order' | 'plans' | 'orders' | 'stores' | 'about';

const NAV: { key: ViewKey; label: string; icon: typeof IconGrid }[] = [
  { key: 'overview', label: '概览', icon: IconGrid },
  { key: 'orders', label: '订单记录', icon: IconReceipt },
  { key: 'plans', label: '常用方案', icon: IconBookmark },
  { key: 'stores', label: '门店', icon: IconStore },
  { key: 'about', label: '关于', icon: IconInfo },
];

interface SidebarProps {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  plansCount: number;
  ordersCount: number;
  storeName: string;
  mode: 'live' | 'demo';
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onPickStore: () => void;
  /** 侧栏底部的「最近的方案」，点一下直接整单复用 */
  recentPlans: Plan[];
  onUsePlan: (p: Plan) => void;
}

/**
 * 侧边导航。
 *
 * 它是工具，不是主体。所以：宽度收窄、底色与页面几乎同色、选中态只靠一条 2px 品牌红
 * 和字重说话，不用整块反色或白卡片 —— 那两种做法都会把导航变成页面里最重的元素。
 */
export function Sidebar({
  view,
  onNavigate,
  plansCount,
  ordersCount,
  storeName,
  mode,
  mobileOpen,
  onCloseMobile,
  onPickStore,
  recentPlans,
  onUsePlan,
}: SidebarProps) {
  const countOf = (k: ViewKey) => (k === 'plans' ? plansCount : k === 'orders' ? ordersCount : undefined);

  const go = (k: ViewKey) => {
    onNavigate(k);
    onCloseMobile();
  };

  return (
    <>
      <div
        className={cx(
          'fixed inset-0 z-40 bg-[#2b201b]/20 transition-opacity duration-200 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[228px] flex-col border-r border-hair',
          'transition-transform duration-250 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0 bg-canvas' : '-translate-x-full lg:bg-[#f7f4f1]',
        )}
        aria-label="主导航"
      >
        {/* 品牌 */}
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-1 pt-6">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-brand-600" aria-hidden="true">
            <IconArches size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block truncate text-[14px] leading-tight text-ink">麦麦老样子</span>
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors duration-150 hover:bg-white hover:text-ink lg:hidden"
            onClick={onCloseMobile}
            aria-label="关闭导航"
          >
            <IconClose size={15} />
          </button>
        </div>

        {/* 主入口 */}
        <div className="px-3.5 pb-2 pt-5">
          <button
            type="button"
            onClick={() => go('order')}
            className={cx(
              'flex w-full items-center gap-2 rounded-md bg-brand-600 py-2 pl-3 pr-2.5 text-left text-white',
              'transition-colors duration-150 ease-out hover:bg-brand-700 active:scale-[0.99]',
              view === 'order' && 'ring-2 ring-brand-200 ring-offset-2 ring-offset-[#f7f4f1]',
            )}
          >
            <IconSparkle size={13} className="shrink-0" />
            <span className="flex-1 text-[13px] font-medium">开始点单</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3.5 py-4">
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.key === view;
              const count = countOf(item.key);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => go(item.key)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'relative flex w-full items-center gap-2.5 rounded-md py-2 pl-3 pr-2.5 text-[13px]',
                      'transition-colors duration-150 ease-out',
                      active ? 'bg-white font-medium text-ink' : 'text-ink-mute hover:bg-white/60 hover:text-ink-soft',
                    )}
                  >
                    {/* 选中态：一条 2px 红杠，比整块反色安静得多 */}
                    <span
                      className={cx(
                        'absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand-600 transition-opacity duration-150',
                        active ? 'opacity-100' : 'opacity-0',
                      )}
                      aria-hidden="true"
                    />
                    <item.icon size={14} className={cx('shrink-0', active ? 'text-ink-soft' : 'text-ink-faint')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count !== undefined && count > 0 ? (
                      <span className="tnum text-[11px] text-ink-faint">{count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 最近的方案：点一下直接整单复用 */}
          {recentPlans.length > 0 ? (
            <div className="mt-7">
              <p className="eyebrow px-3 pb-1.5">最近的方案</p>
              <ul>
                {recentPlans.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onUsePlan(p);
                        onCloseMobile();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left transition-colors duration-150 hover:bg-white/70"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] text-ink-soft">{p.name}</span>
                        <span className="block truncate text-[11px] text-ink-faint">
                          {p.tag ?? '未分类'} · {p.items.length} 项
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>

        {/* 底部：当前门店 */}
        <div className="shrink-0 border-t border-hair p-3">
          <button
            type="button"
            onClick={() => {
              onPickStore();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors duration-150 hover:bg-white/70"
          >
            <IconStore size={14} className="shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-ink-soft">{storeName || '选择门店'}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                <span
                  className={cx('inline-block h-1.5 w-1.5 rounded-full', mode === 'live' ? 'bg-[#5f9d78]' : 'bg-[#d2a34a]')}
                  aria-hidden="true"
                />
                {mode === 'live' ? '真实数据' : '演示数据'}
              </span>
            </span>
            <IconChevronRight size={12} className="shrink-0 text-ink-faint" />
          </button>
        </div>
      </aside>
    </>
  );
}
