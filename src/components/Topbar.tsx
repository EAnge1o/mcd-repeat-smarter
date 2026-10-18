import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryOrder, Plan } from '../../server/domain/types';
import { cx } from './ui';
import { IconArches, IconBell, IconClose, IconMenu, IconSearch, IconStore } from './Icons';
import type { ViewKey } from './Sidebar';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';

interface TopbarProps {
  plans: Plan[];
  orders: HistoryOrder[];
  storeName: string;
  mode: 'live' | 'demo';
  lastSync: string | null;
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

/**
 * 顶部工具栏。
 *
 * 这里**不重复页面的标题** —— 每个页面自己有大标题，顶栏再写一遍就成了两行说同一句话。
 * 顶栏只承担三件事：搜索、门店、数据来源。高度压到 56px，底色与页面一致，
 * 内容滚过去时它像工具条而不像一块独立的「头部」。
 *
 * 搜索是真能搜的：方案按名称/标签，订单按订单号/门店/餐品名。没有命中就明说没找到。
 */
export function Topbar({
  plans,
  orders,
  storeName,
  mode,
  lastSync,
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
      body: mode === 'live' ? '门店、餐品与价格来自官方接口。' : '门店、餐品与价格均为内置示例。',
    },
    {
      tone: 'info',
      title: `取餐门店：${storeName || '未选择'}`,
      body: '切换门店后，菜单与价格按新门店重算。',
    },
    {
      tone: 'info',
      title: lastSync ? `最近读取：${lastSync}` : '尚未读取过历史订单',
      body: '订单只在本机与服务端之间流转。',
    },
  ];

  const results = (
    <>
      {hits.length === 0 ? (
        <p className="px-4 py-5 text-[13px] leading-relaxed text-ink-mute">没有匹配的结果。</p>
      ) : (
        <ul className="max-h-[60vh] overflow-y-auto p-2">
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
                className="flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-100 hover:bg-gold-100"
              >
                <span className="mt-0.5 shrink-0 rounded-full bg-ink/8 px-2 py-0.5 text-[11.5px] font-bold text-ink-mute">{h.kind}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{h.title}</span>
                  <span className="block truncate text-[11.5px] text-ink-faint">{h.sub}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b-[3px] border-ink bg-canvas px-4 md:px-8">
      <button
        type="button"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-ink transition-colors duration-100 hover:bg-ink/8 lg:hidden"
        onClick={onOpenMobile}
        aria-label="打开导航"
      >
        <IconMenu />
      </button>

      {/* 左：数据来源状态 —— 黄色药丸，麦当劳式的状态标签 */}
      <div className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
        <span
          className={cx(
            'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-black',
            mode === 'live' ? 'bg-gold-400 text-ink' : 'bg-ink text-gold-400',
          )}
        >
          <span
            className={cx(
              'inline-block h-2 w-2 rounded-full',
              mode === 'live' ? 'bg-ink' : 'bg-gold-400',
            )}
            aria-hidden="true"
          />
          {mode === 'live' ? '真实接口' : '演示数据'}
        </span>
        <span className="truncate text-[13px] text-ink-mute">
          {mode === 'live' ? '门店与价格来自麦当劳接口' : '门店、餐品与价格为内置示例'}
          {lastSync ? <span className="tnum"> · 最近读取 {lastSync}</span> : null}
        </span>
      </div>
      <div className="min-w-0 flex-1 md:hidden" />

      {/* 搜索：宽屏内联，窄屏点开全宽命令条 */}
      <div ref={boxRef} className="relative hidden w-full max-w-[280px] md:block">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute">
          <IconSearch size={15} />
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
          className="h-10 w-full rounded-full bg-white pl-10 pr-4 text-[13px] font-medium text-ink ring-2 ring-ink/15 transition-shadow duration-100 placeholder:font-normal placeholder:text-ink-faint focus:bg-white focus:outline-none focus:ring-ink/40"
        />
        {open && q.trim() ? (
          <div className="float absolute left-0 right-0 top-12 z-40 overflow-hidden rounded-2xl">{results}</div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setMobileSearch(true)}
          className="grid h-10 w-10 place-items-center rounded-full text-ink transition-colors duration-100 hover:bg-ink/8 md:hidden"
          aria-label="搜索"
        >
          <IconSearch size={16} />
        </button>

        <button
          type="button"
          onClick={onPickStore}
          className="hidden h-9 items-center gap-2 rounded-full bg-ink/6 px-3.5 text-[13px] font-bold text-ink transition-colors duration-100 hover:bg-ink/12 xl:flex"
        >
          <IconStore size={14} className="text-brand-600" />
          <span className="max-w-[130px] truncate">{storeName || '选择门店'}</span>
        </button>

        <div ref={noticeRef} className="relative">
          <button
            type="button"
            onClick={() => setNoticeOpen((v) => !v)}
            aria-expanded={noticeOpen}
            aria-label="数据来源"
            className={cx(
              'grid h-10 w-10 place-items-center rounded-full transition-colors duration-100 hover:bg-ink/8',
              noticeOpen ? 'bg-ink text-white hover:bg-ink/12' : 'text-ink',
            )}
          >
            <IconBell size={16} />
          </button>

          {noticeOpen ? (
            <div className="float absolute right-0 top-12 z-40 w-[320px] overflow-hidden rounded-2xl">
              <p className="bg-ink px-4 py-2.5 text-[13px] font-black text-gold-400">数据来源</p>
              <ul className="divide-y divide-ink/8">
                {notices.map((n) => (
                  <li key={n.title} className="px-4 py-3">
                    <p className="text-[13px] font-bold text-ink">{n.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-mute">{n.body}</p>
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
          className="ml-0.5 grid h-10 w-10 place-items-center rounded-full bg-brand-500 text-gold-400 shadow-brand-press transition-colors duration-100 hover:bg-brand-600 active:translate-y-[3px] active:shadow-none"
        >
          <IconArches size={18} />
        </button>
      </div>

      {/* 窄屏搜索：整条命令栏浮在页面之上 */}
      {mobileSearch ? (
        <div className="fixed inset-0 z-[55] bg-ink/50 md:hidden">
          <div className="float animate-fade-up mx-3 mt-3 overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2.5 border-b-2 border-ink/10 px-4 py-3.5">
              <IconSearch size={15} className="shrink-0 text-ink-faint" />
              <input
                ref={mobileInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜方案、订单、餐品"
                aria-label="搜索"
                className="h-7 min-w-0 flex-1 bg-transparent text-[14px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={() => {
                  setMobileSearch(false);
                  setQ('');
                }}
                aria-label="关闭搜索"
                className="grid h-8 w-8 place-items-center rounded-full text-ink-faint hover:bg-ink/8 hover:text-ink"
              >
                <IconClose size={15} />
              </button>
            </div>
            {q.trim() ? results : <p className="px-4 py-5 text-[13px] text-ink-faint">输入方案名、订单号、门店或餐品名。</p>}
          </div>
        </div>
      ) : null}

    </header>
  );
}
