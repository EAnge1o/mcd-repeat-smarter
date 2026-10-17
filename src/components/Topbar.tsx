import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryOrder, Plan } from '../../server/domain/types';
import { cx } from './ui';
import { IconBell, IconMenu, IconSearch, IconStore } from './Icons';
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
 * 搜索是真的能搜：方案按名称/标签，订单按订单号/门店/餐品名。
 * 不做「假装有搜索」——输入没命中就明说没找到。
 */
export function Topbar({ plans, orders, storeName, mode, lastSync, onNavigate, onOpenMobile, onPickStore }: TopbarProps) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
      if (noticeRef.current && !noticeRef.current.contains(e.target as Node)) setNoticeOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const key = q.trim().toLowerCase();
    if (!key) return [];

    const planHits: Hit[] = plans
      .filter((p) => `${p.name} ${p.tag ?? ''}`.toLowerCase().includes(key))
      .slice(0, 4)
      .map((p) => ({
        id: `p-${p.id}`,
        kind: '方案',
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
          kind: '订单',
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
      body: '在侧边栏底部或这里可以切换门店，切换后方案与核价都会按新门店重算。',
    },
    {
      tone: 'info',
      title: lastSync ? `最近读取：${lastSync}` : '尚未读取过历史订单',
      body: '订单记录只在你本机与服务端之间流转，Token 不会出现在浏览器。',
    },
  ];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#4b4945] transition-colors duration-150 hover:bg-[#f2f0ec] lg:hidden"
        onClick={onOpenMobile}
        aria-label="打开导航"
      >
        <IconMenu />
      </button>

      {/* 搜索 */}
      <div ref={boxRef} className="relative w-full max-w-sm">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8a877f]">
          <IconSearch size={15} />
        </div>
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
          placeholder="搜索方案、订单或餐品"
          aria-label="搜索方案、订单或餐品"
          className="h-9 w-full rounded-lg border border-line bg-[#faf9f7] pl-9 pr-3 text-sm text-[#111827] transition-all duration-150 placeholder:text-[#a8a49c] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />

        {open && q.trim() ? (
          <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-line bg-white shadow-lift">
            {hits.length === 0 ? (
              <p className="px-3.5 py-4 text-xs text-[#8a877f]">没有匹配的方案或订单。换个关键词，或者直接去「开始点单」。</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate(h.view);
                        setOpen(false);
                        setQ('');
                      }}
                      className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-[#faf9f7]"
                    >
                      <span className="mt-0.5 rounded-md bg-[#f2f0ec] px-1.5 py-0.5 text-[10px] text-[#6b6862]">{h.kind}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-[#111827]">{h.title}</span>
                        <span className="block truncate text-[11px] text-[#8a877f]">{h.sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={onPickStore}
          className="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-[#4b4945] transition-colors duration-150 hover:bg-[#f2f0ec] sm:flex"
        >
          <IconStore size={14} className="text-[#8a877f]" />
          <span className="max-w-[150px] truncate">{storeName || '选择门店'}</span>
        </button>

        {/* 通知 */}
        <div ref={noticeRef} className="relative">
          <button
            type="button"
            onClick={() => setNoticeOpen((v) => !v)}
            aria-expanded={noticeOpen}
            aria-label="通知与数据来源"
            className={cx(
              'relative grid h-9 w-9 place-items-center rounded-lg transition-colors duration-150 hover:bg-[#f2f0ec]',
              noticeOpen ? 'bg-[#f2f0ec] text-[#111827]' : 'text-[#4b4945]',
            )}
          >
            <IconBell size={16} />
            <span
              className={cx(
                'absolute right-2 top-2 h-1.5 w-1.5 rounded-full ring-2 ring-white',
                mode === 'live' ? 'bg-[#22c55e]' : 'bg-[#f59e0b]',
              )}
              aria-hidden="true"
            />
          </button>

          {noticeOpen ? (
            <div className="absolute right-0 top-11 z-40 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-lift">
              <div className="border-b border-line px-3.5 py-2.5 text-xs font-semibold text-[#111827]">数据来源</div>
              <ul className="divide-y divide-line">
                {notices.map((n) => (
                  <li key={n.title} className="px-3.5 py-2.5">
                    <p className="flex items-center gap-1.5 text-[12px] font-medium text-[#3d3a35]">
                      <span
                        className={cx(
                          'inline-block h-1.5 w-1.5 rounded-full',
                          n.tone === 'ok' ? 'bg-[#22c55e]' : n.tone === 'warn' ? 'bg-[#f59e0b]' : 'bg-[#c9c5bd]',
                        )}
                        aria-hidden="true"
                      />
                      {n.title}
                    </p>
                    <p className="mt-0.5 pl-3 text-[11px] leading-relaxed text-[#8a877f]">{n.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden="true" />

        {/* 用户 */}
        <button
          type="button"
          onClick={() => onNavigate('about')}
          className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors duration-150 hover:bg-[#f2f0ec]"
          aria-label="关于本项目"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-[11px] font-semibold text-brand-700" aria-hidden="true">
            我
          </span>
          <span className="hidden text-left md:block">
            <span className="block text-[12px] leading-tight text-[#111827]">我的账号</span>
            <span className="block text-[10px] leading-tight text-[#8a877f]">参赛演示</span>
          </span>
        </button>
      </div>
    </header>
  );
}
