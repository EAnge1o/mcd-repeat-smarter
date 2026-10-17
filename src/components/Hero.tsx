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
    <section aria-labelledby="hero-title" className="mx-auto max-w-[720px] px-1 text-center">
      <p className="eyebrow">记住你常点的 · 听懂你这次改的</p>

      <h1
        id="hero-title"
        className="display mx-auto mt-5 text-[clamp(34px,5.2vw,62px)] leading-[1.12] tracking-[-0.04em] text-ink"
      >
        {/* 全角逗号自带一个字宽的空白，不收一下会在 62px 下断成「两个空格」。写成一行，避免 JSX 换行变成行内空格 */}
        今天<span className="mr-[-0.14em]">，</span>还是<span className="whitespace-nowrap text-brand-600">老样子</span>吗？
      </h1>

      <p className="mx-auto mt-6 max-w-[30rem] text-pretty text-[12.5px] font-light leading-[1.95] text-ink-mute md:text-[13px]">
        {/* 断行写死：让「20 元以内」不被拆开，破折号落在行首 */}
        整单照旧、去掉一样、换个饮料，或者压到 20 元以内
        <br />
        —— 说一句就行，其余交给它。
      </p>

      <div className="mt-8 text-left">
        <Composer onSubmit={onSubmit} quickPrompts={quickPrompts} initialValue={prefill} />
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center">
          <Skeleton className="h-3 w-64" />
        </div>
      ) : lastOrder ? (
        <div className="mt-5 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
          <span className="eyebrow">最近一单</span>
          <span className="tnum">{fmtDateTime(lastOrder.createTime)}</span>
          <span className="text-[#d5cec6]">·</span>
          <span className="max-w-[280px] truncate" title={orderSummary(lastOrder)}>
            {orderSummary(lastOrder)}
          </span>
          <button
            type="button"
            onClick={onUseLatest}
            className="group inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-medium text-brand-600 transition-colors duration-200 hover:bg-brand-50"
          >
            照这份再来
            <IconArrow size={10} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : null}

      {demoReason ? (
        <p className="mx-auto mt-5 flex max-w-[34rem] items-start justify-center gap-1.5 text-[10.5px] leading-relaxed text-[#7a5a1c]">
          <span className="mt-[3px] shrink-0">
            <IconAlert size={11} />
          </span>
          <span>当前展示内置示例数据，门店、餐品与价格不代表真实供应情况（{demoReason}）。</span>
        </p>
      ) : null}
    </section>
  );
}
