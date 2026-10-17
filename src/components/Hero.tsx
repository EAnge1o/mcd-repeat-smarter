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
  /** 从右栏/其他位置点「按这个点一单」时填进输入框的话 */
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
 * 所以这里不包卡片：标题、说明、输入框直接落在页面底上，用字号和留白建立层级。
 * 数据统计移到右侧注解栏，别让「回看」型信息抢走「下一步做什么」的位置。
 */
export function Hero({ lastOrder, loading, quickPrompts, prefill, demoReason, onSubmit, onUseLatest }: HeroProps) {
  return (
    <section aria-labelledby="hero-title">
      <h1
        id="hero-title"
        className="text-[26px] font-semibold leading-[1.2] tracking-tight text-[#111827] md:text-[34px] md:leading-[1.15]"
      >
        今天，还是<span className="text-brand-600">老样子</span>吗？
      </h1>

      <p className="mt-2.5 max-w-[46ch] text-[13px] leading-relaxed text-[#57534c] md:text-[13.5px]">
        说一句你想怎么改就行 —— 记得你的习惯，也听得懂今天的小变化。
      </p>

      <div className="mt-5 md:mt-6">
        <Composer onSubmit={onSubmit} quickPrompts={quickPrompts} initialValue={prefill} />
      </div>

      {loading ? (
        <div className="mt-3.5">
          <Skeleton className="h-3 w-72 max-w-full" />
        </div>
      ) : lastOrder ? (
        <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="min-w-0 flex-1 truncate text-[11.5px] text-[#6f6a62]" title={orderSummary(lastOrder)}>
            <span className="text-[#57534c]">最近一单</span>
            <span className="px-1.5">·</span>
            <span className="tnum">{fmtDateTime(lastOrder.createTime)}</span>
            <span className="px-1.5">·</span>
            {orderSummary(lastOrder)}
          </p>
          <button
            type="button"
            onClick={onUseLatest}
            className="group inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-brand-600 transition-colors duration-150 hover:bg-brand-50"
          >
            照这份再来一单
            <IconArrow size={11} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </button>
        </div>
      ) : null}

      {demoReason ? (
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-[#6d4c11]">
          <span className="mt-[3px] shrink-0 text-[#a17317]">
            <IconAlert size={12} />
          </span>
          <span>
            当前展示内置示例数据，门店、餐品与价格不代表真实供应情况（{demoReason}）。
          </span>
        </p>
      ) : null}
    </section>
  );
}
