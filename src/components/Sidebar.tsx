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

const NAV: { key: ViewKey; label: string; icon: typeof IconGrid; hint: string }[] = [
  { key: 'overview', label: '概览', icon: IconGrid, hint: '数据与快捷入口' },
  { key: 'order', label: '开始点单', icon: IconSparkle, hint: '一句话调整并核价' },
  { key: 'plans', label: '常用方案', icon: IconBookmark, hint: '整单复用' },
  { key: 'orders', label: '订单记录', icon: IconReceipt, hint: '历史与来源' },
  { key: 'stores', label: '门店', icon: IconStore, hint: '切换取餐门店' },
  { key: 'about', label: '关于', icon: IconInfo, hint: '数据来源说明' },
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
}

/**
 * 深色侧边导航。
 *
 * 底色不用 stylekit 默认的 gray-900：整站的中性色是暖灰，插一块冷灰会和品牌红打架，
 * 所以取品牌红的 950 档（#210706）。当前页用 bg-white/10 高亮，不加左侧粗色条
 * （单侧 accent stripe 是明确禁止项）。
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
}: SidebarProps) {
  const countOf = (k: ViewKey) => (k === 'plans' ? plansCount : k === 'orders' ? ordersCount : undefined);

  return (
    <>
      {/* 移动端遮罩 */}
      <div
        className={cx(
          'fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] transition-opacity duration-200 lg:hidden',
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-brand-950',
          'transition-transform duration-200 ease-out lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="主导航"
      >
        {/* 品牌 */}
        <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-white/[0.08] px-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500" aria-hidden="true">
            <IconArches size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold tracking-tight text-white">麦麦老样子</span>
            <span className="block truncate text-[10px] tracking-[0.16em] text-white/35">REPEAT SMARTER</span>
          </span>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onCloseMobile}
            aria-label="关闭导航"
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* 菜单 */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <p className="px-2 pb-1.5 text-[11px] text-white/30">工作台</p>
          <ul className="space-y-0.5">
            {NAV.map((item) => {
              const active = item.key === view;
              const count = countOf(item.key);
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigate(item.key);
                      onCloseMobile();
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ease-out',
                      active ? 'bg-white/10 font-medium text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
                    )}
                  >
                    <item.icon size={16} className={cx('shrink-0', active ? 'text-white' : 'text-white/45 group-hover:text-white/80')} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {count !== undefined && count > 0 ? (
                      <span className={cx('tnum text-[11px]', active ? 'text-white/55' : 'text-white/30')}>{count}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* 底部：当前门店与数据来源 */}
        <div className="shrink-0 border-t border-white/[0.08] p-2.5">
          <button
            type="button"
            onClick={() => {
              onPickStore();
              onCloseMobile();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors duration-150 hover:bg-white/[0.06]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[11px] font-semibold text-white/80" aria-hidden="true">
              店
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-white/85">{storeName || '选择门店'}</span>
              <span className="flex items-center gap-1 text-[11px] text-white/40">
                <span
                  className={cx('inline-block h-1.5 w-1.5 rounded-full', mode === 'live' ? 'bg-[#4ade80]' : 'bg-[#fbbf24]')}
                  aria-hidden="true"
                />
                {mode === 'live' ? '真实 MCP 数据' : '演示数据'}
              </span>
            </span>
            <IconChevronRight size={12} className="shrink-0 text-white/25" />
          </button>
        </div>
      </aside>
    </>
  );
}
