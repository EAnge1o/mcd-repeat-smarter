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
  /** 侧栏底部的「最近的方案」，像刊物目录里的近期条目 */
  recentPlans: Plan[];
  onUsePlan: (p: Plan) => void;
}

/**
 * 侧边导航。
 *
 * 不是深色控制台侧栏：底色是半透明白，靠一条发丝线跟内容区分开。
 * 选中项用一枚白胶囊（+ 极轻投影）表示，不用左侧色条，也不整块反色 ——
 * 反色会把导航变成页面里最重的色块，抢走主内容的注意力。
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
          'fixed inset-0 z-40 bg-[#2b201b]/25 backdrop-blur-[2px] transition-opacity duration-300 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-hair bg-white/70 backdrop-blur-xl',
          'transition-transform duration-300 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="主导航"
      >
        {/* 品牌 */}
        <div className="flex shrink-0 items-center gap-2.5 px-5 pb-1 pt-5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500" aria-hidden="true">
            <IconArches size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block truncate text-[15px] leading-tight text-ink">麦麦老样子</span>
            <span className="eyebrow mt-1 block text-[8.5px] tracking-[0.2em]">REPEAT SMARTER</span>
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors duration-200 hover:bg-white hover:text-ink lg:hidden"
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
              'group flex w-full items-center gap-2 rounded-full bg-white py-2 pl-3.5 pr-2.5 text-left',
              'shadow-pill ring-1 ring-inset transition-all duration-200 ease-out hover:shadow-float',
              view === 'order' ? 'ring-brand-200' : 'ring-line',
            )}
          >
            <IconSparkle size={13} className="shrink-0 text-brand-600" />
            <span className="flex-1 text-[12.5px] font-medium text-ink">开始点单</span>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#f4f0ec] text-ink-mute transition-colors duration-200 group-hover:bg-ink group-hover:text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3.5 py-4">
          <p className="eyebrow px-2.5 pb-2">工作台</p>
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
                      'group flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-[12.5px]',
                      'transition-[background-color,color,box-shadow] duration-200 ease-out',
                      active
                        ? 'bg-white font-medium text-ink shadow-pill ring-1 ring-inset ring-line'
                        : 'text-ink-mute hover:bg-white/60 hover:text-ink',
                    )}
                  >
                    <item.icon size={15} className={cx('shrink-0', active ? 'text-brand-600' : 'text-ink-faint group-hover:text-ink-mute')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count !== undefined && count > 0 ? (
                      <span className="tnum font-mono text-[10px] text-ink-faint">{count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 最近的方案：像刊物目录里的「近期条目」，点一下直接整单复用 */}
          {recentPlans.length > 0 ? (
            <div className="mt-7">
              <p className="eyebrow px-2.5 pb-2">最近的方案</p>
              <ul>
                {recentPlans.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onUsePlan(p);
                        onCloseMobile();
                      }}
                      className="group flex w-full items-start gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-white/70"
                    >
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#f4f0ec] font-mono text-[9px] text-ink-mute" aria-hidden="true">
                        {p.tag ? p.tag.slice(0, 1) : '方'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] text-ink-soft group-hover:text-ink">{p.name}</span>
                        <span className="block truncate text-[10px] text-ink-faint">
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
            className="flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-white/70"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f4f0ec] text-ink-mute" aria-hidden="true">
              <IconStore size={14} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] text-ink-soft">{storeName || '选择门店'}</span>
              <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-ink-faint">
                <span
                  className={cx('inline-block h-1.5 w-1.5 rounded-full', mode === 'live' ? 'bg-[#5f9d78]' : 'bg-[#d2a34a]')}
                  aria-hidden="true"
                />
                {mode === 'live' ? '真实 MCP 数据' : '演示数据'}
              </span>
            </span>
            <IconChevronRight size={12} className="shrink-0 text-ink-faint" />
          </button>
        </div>
      </aside>
    </>
  );
}
