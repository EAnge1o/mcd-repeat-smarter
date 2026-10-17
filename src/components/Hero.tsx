import type { HistoryOrder } from '../../server/domain/types';
import { Composer } from './Composer';
import { IconArrow, IconAlert } from './Icons';
import { Skeleton } from './ui';
import { fmtDateTime, paidCents, yuan } from '../lib/metrics';

interface HeroProps {
  /** 最近一单，用来做「照这份再来」的快捷入口；没有历史订单时不给这一行 */
  lastOrder: HistoryOrder | null;
  loading?: boolean;
  quickPrompts: string[];
  /** 从注解栏/其他位置点「按这个点一单」时填进输入框的话 */
  prefill: string;
  demoReason?: string;
  onSubmit: (text: string) => void;
  onUseLatest: () => void;
}

/** 一句话摘要：几个餐品、多少钱 */
function orderSummary(o: HistoryOrder): string {
  const c = paidCents(o);
  const head = o.items
    .slice(0, 2)
    .map((i) => `${i.quantity}×${i.name}`)
    .join('、');
  const rest = o.items.length > 2 ? ` 等 ${o.items.length} 项` : '';
  const money = c === null ? '金额未返回' : `¥${yuan(c)}`;
  return `${head || '（无明细）'}${rest} · ${money}`;
}

/**
 * 首屏主舞台 —— 这一屏的全部意义是「用一句话开始下一单」。
 *
 * 所以它是居中的单栏，像一页扉页：一行 mono 元信息、一句衬线大字、一层浮起的输入框。
 * 不包卡片、不放图表、不在左右塞侧栏 —— 首屏只允许存在一个动作。
 */
export function Hero({ lastOrder, loading, quickPrompts, prefill, demoReason, onSubmit, onUseLatest }: HeroProps) {
  return (
    <section aria-labelledby="hero-title" className="mx-auto max-w-[760px] px-1 text-center">
      {/* 金拱门放大落位。这是麦当劳最强的形状资产，首屏就该用它开场 */}
      <span
        className="animate-arch-in mx-auto grid h-[76px] w-[76px] place-items-center rounded-full bg-gold-400 shadow-[0_4px_0_rgba(154,106,0,1)]"
        aria-hidden="true"
      >
        <svg width="44" height="42" viewBox="0 0 104 100" fill="none">
          <path
            d="M13 92V66C13 37 23.9 8 32.5 8S52 37 52 66V92C52 37 60.6 8 71.5 8S91 37 91 66V92"
            stroke="#0d0d0d"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>

      <p className="eyebrow mt-6">记住你常点的 · 听懂你这次改的</p>

      <h1
        id="hero-title"
        className="display mx-auto mt-5 text-[clamp(38px,6.4vw,68px)] leading-[1.04] text-ink"
      >
        {/* 全角逗号自带一个字宽的空白，收一下避免在大字下断成「两个空格」。写成一行，避免 JSX 换行变成行内空格 */}
        今天<span className="mr-[-0.14em]">，</span>还是<span className="whitespace-nowrap text-brand-600">老样子</span>吗？
      </h1>

      <p className="mx-auto mt-5 max-w-[34rem] text-pretty text-[15px] font-medium leading-[1.8] text-ink-soft">
        整单照旧、去掉一样、换个饮料，或者压到 20 元以内
        <br />
        —— 说一句就行，其余交给它。
      </p>

      <div className="mt-8 text-left">
        <Composer onSubmit={onSubmit} quickPrompts={quickPrompts} initialValue={prefill} />
      </div>

      {loading ? (
        <div className="mt-6 flex justify-center">
          <Skeleton className="h-9 w-64 rounded-full" />
        </div>
      ) : lastOrder ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[13px]">
          <span className="eyebrow">最近一单</span>
          <span className="tnum">{fmtDateTime(lastOrder.createTime)}</span>
          <span className="max-w-[300px] truncate font-medium text-ink-mute" title={orderSummary(lastOrder)}>
            {orderSummary(lastOrder)}
          </span>
          <button
            type="button"
            onClick={onUseLatest}
            className="group inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-4 text-[13px] font-black text-white shadow-[0_3px_0_rgba(13,13,13,0.28)] transition-colors duration-100 hover:bg-ink-soft active:translate-y-[3px] active:shadow-none"
          >
            照这份再来
            <IconArrow size={11} className="transition-transform duration-100 group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : null}

      {demoReason ? (
        <p className="mx-auto mt-6 flex max-w-[36rem] items-start justify-center gap-2 rounded-full bg-gold-100 px-5 py-2.5 text-[13px] font-medium leading-relaxed text-[#6b4a00] ring-2 ring-gold-300">
          <span className="mt-[3px] shrink-0">
            <IconAlert size={12} />
          </span>
          <span>当前展示内置示例数据，门店、餐品与价格不代表真实供应情况（{demoReason}）。</span>
        </p>
      ) : null}
    </section>
  );
}
