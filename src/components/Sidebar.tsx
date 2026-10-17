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
 * 这一版改成**深色底 + 红色选中块 + 黄色金拱门**。
 * 之前是「底色与页面同色、选中只靠一条 2px 红杠」—— 那是日式工具软件的做法，
 * 麦当劳从不做隐藏式导航，它就是要让人一眼看到品牌和位置。
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
          'fixed inset-0 z-40 bg-ink/50 transition-opacity duration-150 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-ink text-white',
          'transition-transform duration-250 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="主导航"
      >
        {/* 品牌：金拱门放大 + 超重标题 */}
        <div className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-6">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-400 text-ink"
            aria-hidden="true"
          >
            <IconArches size={26} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block truncate text-[16px] leading-tight text-white">麦麦老样子</span>
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-white/60 transition-colors duration-100 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onCloseMobile}
            aria-label="关闭导航"
          >
            <IconClose size={15} />
          </button>
        </div>

        {/* 主入口：红色实体大按钮 */}
        <div className="px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={() => go('order')}
            className={cx(
              'flex w-full items-center gap-2 rounded-full bg-brand-500 py-3 pl-4 pr-3.5 text-left text-white',
              'shadow-brand-press transition-colors duration-100 hover:bg-brand-600 active:translate-y-[3px] active:shadow-none',
            )}
          >
            <IconSparkle size={14} className="shrink-0" />
            <span className="flex-1 text-[14px] font-black">开始点单</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <ul className="space-y-1">
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
                      'flex w-full items-center gap-3 rounded-full py-2.5 pl-4 pr-3.5 text-[14px] font-bold',
                      'transition-colors duration-100 ease-out',
                      active
                        ? 'bg-brand-500 text-white shadow-brand-press'
                        : 'text-white/70 hover:bg-white/10 hover:text-white',
                    )}
                  >
                    <item.icon size={15} className="shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count !== undefined && count > 0 ? (
                      <span
                        className={cx(
                          'tnum rounded-full px-2 py-0.5 text-[11.5px] font-black',
                          active ? 'bg-white/25 text-white' : 'bg-white/10 text-white/70',
                        )}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 最近的方案：点一下直接整单复用 */}
          {recentPlans.length > 0 ? (
            <div className="mt-7">
              <p className="px-3 pb-2 text-[11.5px] font-black uppercase tracking-[0.14em] text-gold-400">最近的方案</p>
              <ul>
                {recentPlans.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onUsePlan(p);
                        onCloseMobile();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left transition-colors duration-100 hover:bg-white/10"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-white/90">{p.name}</span>
                        <span className="block truncate text-[11.5px] text-white/45">
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
        <div className="shrink-0 border-t-2 border-white/10 p-3">
          <button
            type="button"
            onClick={() => {
              onPickStore();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-left transition-colors duration-100 hover:bg-white/10"
          >
            <IconStore size={15} className="shrink-0 text-gold-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-white/90">{storeName || '选择门店'}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-white/45">
                <span
                  className={cx('inline-block h-2 w-2 rounded-full', mode === 'live' ? 'bg-[#4ade80]' : 'bg-gold-400')}
                  aria-hidden="true"
                />
                {mode === 'live' ? '真实数据' : '演示数据'}
              </span>
            </span>
            <IconChevronRight size={13} className="shrink-0 text-white/40" />
          </button>
        </div>
      </aside>
    </>
  );
}
