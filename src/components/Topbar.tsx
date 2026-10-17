import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryOrder, Plan } from '../../server/domain/types';
import { cx } from './ui';
import { IconBell, IconClose, IconMenu, IconSearch, IconStore } from './Icons';
import type { ViewKey } from './Sidebar';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';

interface TopbarProps {
  view: ViewKey;
  plans: Plan[];
  orders: HistoryOrder[];
  storeName: string;
  mode: 'live' | 'demo';
  lastSync: string | null;
  dateLabel: string;
  onNavigate: (v: ViewKey) => void;
  onOpenMobile: () => void;
  onPickStore: () => void;
}

interface Hit {
  id: string;
  kind: '方案' | '订单';
  title: string;
  sub: string;
  view: ViewKey;
}

const TITLES: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: '概览', sub: '今天这一单' },
  order: { title: '点单', sub: '一句话调整' },
  plans: { title: '常用方案', sub: '存下来整单复用' },
  orders: { title: '订单记录', sub: '历史与来源' },
  stores: { title: '门店', sub: '菜单与价格的基础' },
  about: { title: '关于', sub: '数据从哪来' },
};

/**
 * 顶部栏。
 *
 * 没有一块实色背景压在最上面：底色跟页面同色、加一层模糊，内容滚动时从它下面滑过去，
 * 页面才像一整张纸，而不是「头 + 身体」两截。
 *
 * 搜索是真能搜的：方案按名称/标签，订单按订单号/门店/餐品名。没有命中就明说没找到。
 */
export function Topbar({
  view,
  plans,
  orders,
  storeName,
  mode,
  lastSync,
  dateLabel,
  onNavigate,
  onOpenMobile,
  onPickStore,
}: TopbarProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const mobileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
      if (noticeRef.current && !noticeRef.current.contains(e.target as Node)) setNoticeOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (mobileSearch) mobileInput.current?.focus();
  }, [mobileSearch]);

  const hits = useMemo<Hit[]>(() => {
    const key = q.trim().toLowerCase();
    if (!key) return [];

    const planHits: Hit[] = plans
      .filter((p) => `${p.name} ${p.tag ?? ''}`.toLowerCase().includes(key))
      .slice(0, 4)
      .map((p) => ({
        id: `p-${p.id}`,
        kind: '方案' as const,
        title: p.name,
        sub: `${p.tag ?? '未分类'} · ${p.items.length} 项 · ${p.storeName || p.storeCode}`,
        view: 'plans' as ViewKey,
      }));

    const orderHits: Hit[] = orders
      .filter((o) => `${o.orderId} ${o.storeName} ${o.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(key))
      .slice(0, 4)
      .map((o) => {
        const c = paidCents(o);
        return {
          id: `o-${o.orderId}`,
          kind: '订单' as const,
          title: o.items.map((i) => i.name).join('、') || '（无明细）',
          sub: `${fmtDateTime(o.createTime)} · ${c === null ? '金额未返回' : `¥${yuan(c)}`}`,
          view: 'orders' as ViewKey,
        };
      });

    return [...planHits, ...orderHits];
  }, [q, plans, orders]);

  const notices = [
    {
      tone: mode === 'live' ? 'ok' : 'warn',
      title: mode === 'live' ? '已连接麦当劳 MCP' : '当前是演示数据',
      body: mode === 'live' ? '门店、餐品与价格均来自官方接口实时返回。' : '门店、餐品与价格均为内置示例，不代表真实供应情况。',
    },
    {
      tone: 'info',
      title: `取餐门店：${storeName || '未选择'}`,
      body: '在左下角或这里切换门店，切换后方案与核价都会按新门店重算。',
    },
    {
      tone: 'info',
      title: lastSync ? `最近读取：${lastSync}` : '尚未读取过历史订单',
      body: '订单记录只在你本机与服务端之间流转，Token 不会出现在浏览器。',
    },
  ];

  const results = (
    <>
      {hits.length === 0 ? (
        <p className="px-4 py-5 text-[12px] leading-relaxed text-ink-mute">没有匹配的方案或订单。换个关键词，或者直接去「点单」说一句话。</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto p-1.5">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => {
                  onNavigate(h.view);
                  setOpen(false);
                  setMobileSearch(false);
                  setQ('');
                }}
                className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 hover:bg-[#f8f4f0]"
              >
                <span className="mt-1 shrink-0 font-mono text-[9px] tracking-[0.1em] text-ink-faint">{h.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-ink">{h.title}</span>
                  <span className="block truncate text-[10.5px] text-ink-faint">{h.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-hair bg-[#faf8f6]/72 px-4 backdrop-blur-xl md:px-8">
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors duration-200 hover:bg-white/80 lg:hidden"
        onClick={onOpenMobile}
        aria-label="打开导航"
      >
        <IconMenu />
      </button>

      {/* 标题：衬线大字 + 一行 mono 元信息 */}
      <div className="min-w-0 flex-1">
        <p className="eyebrow truncate">
          <span className="tnum">{dateLabel}</span>
          <span className="px-1.5 text-[#c9c2ba]">/</span>
          {TITLES[view].sub}
        </p>
        <h1 className="display truncate text-[16px] leading-tight text-ink md:text-[17px]">{TITLES[view].title}</h1>
      </div>

      {/* 搜索：宽屏内联，窄屏点开全宽命令条 */}
      <div ref={boxRef} className="relative hidden w-full max-w-[230px] md:block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
          <IconSearch size={14} />
        </span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQ('');
              setOpen(false);
            }
          }}
          placeholder="搜方案、订单、餐品"
          aria-label="搜索方案、订单或餐品"
          className="h-9 w-full rounded-full bg-white/60 pl-9 pr-3.5 text-[12px] text-ink ring-1 ring-inset ring-line transition-all duration-200 placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-brand-300"
        />
        {open && q.trim() ? (
          <div className="float absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-2xl">{results}</div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMobileSearch(true)}
          className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors duration-200 hover:bg-white/80 md:hidden"
          aria-label="搜索"
        >
          <IconSearch size={16} />
        </button>

        <button
          type="button"
          onClick={onPickStore}
          className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-[11.5px] text-ink-soft transition-colors duration-200 hover:bg-white/80 xl:flex"
        >
          <IconStore size={13} className="text-ink-faint" />
          <span className="max-w-[130px] truncate">{storeName || '选择门店'}</span>
        </button>

        <div ref={noticeRef} className="relative">
          <button
            type="button"
            onClick={() => setNoticeOpen((v) => !v)}
            aria-expanded={noticeOpen}
            aria-label="通知与数据来源"
            className={cx(
              'relative grid h-9 w-9 place-items-center rounded-full transition-colors duration-200 hover:bg-white/80',
              noticeOpen ? 'bg-white text-ink' : 'text-ink-soft',
            )}
          >
            <IconBell size={15} />
            <span
              className={cx(
                'absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full',
                mode === 'live' ? 'bg-[#5f9d78]' : 'bg-[#d2a34a]',
              )}
              aria-hidden="true"
            />
          </button>

          {noticeOpen ? (
            <div className="float absolute right-0 top-11 z-40 w-[300px] overflow-hidden rounded-2xl">
              <p className="eyebrow border-b border-hair px-4 py-3">数据来源</p>
              <ul className="divide-y divide-hair">
                {notices.map((n) => (
                  <li key={n.title} className="px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink">
                      <span
                        className={cx(
                          'inline-block h-1.5 w-1.5 rounded-full',
                          n.tone === 'ok' ? 'bg-[#5f9d78]' : n.tone === 'warn' ? 'bg-[#d2a34a]' : 'bg-[#c9c2ba]',
                        )}
                        aria-hidden="true"
                      />
                      {n.title}
                    </p>
                    <p className="mt-1 pl-3 text-[10.5px] leading-relaxed text-ink-faint">{n.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onNavigate('about')}
          aria-label="关于本项目"
          className="ml-0.5 grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#f6ded8] to-[#f2e3c8] text-[10.5px] font-medium text-[#7a4b3c] ring-1 ring-white/80 transition-transform duration-200 hover:scale-[1.04]"
        >
          我
        </button>
      </div>

      {/* 窄屏搜索：整条命令栏浮在页面之上 */}
      {mobileSearch ? (
        <div className="fixed inset-0 z-[55] bg-[#2b201b]/20 backdrop-blur-[2px] md:hidden">
          <div className="float animate-fade-up mx-3 mt-3 overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2 border-b border-hair px-4 py-3">
              <IconSearch size={15} className="shrink-0 text-ink-faint" />
              <input
                ref={mobileInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜方案、订单、餐品"
                aria-label="搜索"
                className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => {
                  setMobileSearch(false);
                  setQ('');
                }}
                aria-label="关闭搜索"
                className="grid h-7 w-7 place-items-center rounded-full text-ink-faint"
              >
                <IconClose size={15} />
              </button>
            </div>
            {q.trim() ? results : <p className="px-4 py-5 text-[12px] text-ink-faint">输入方案名、订单号、门店或餐品名。</p>}
          </div>
        </div>
      ) : null}
    </header>
  );
}
