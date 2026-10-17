import type { Plan } from '../../server/domain/types';
import type { AdjustResult } from '../api';
import { Alert, Badge, Button, EmptyState, Panel } from '../components/ui';
import { Composer } from '../components/Composer';
import { AdjustResultView } from '../components/AdjustResultView';
import { IconArrow, IconSparkle, IconStore } from '../components/Icons';
import type { ViewKey } from '../components/Sidebar';

const QUICK_PROMPTS = ['还是老样子', '不要薯条，换个别的', '饮料换成无糖的', '不超过 20 元'];

const EXAMPLES = [
  { text: '还是老样子', hint: '原样复购' },
  { text: '不要薯条，换个别的', hint: '去掉一项并补一个' },
  { text: '饮料换成无糖的', hint: '带偏好的替换' },
  { text: '不超过 20 元', hint: '预算约束' },
];

interface OrderViewProps {
  adjusting: boolean;
  result: AdjustResult | null;
  selectedId: string;
  error: { message: string; hint?: string } | null;
  mode: 'live' | 'demo';
  storeName: string;
  plans: Plan[];
  onSubmit: (text: string) => void;
  onSelect: (id: string) => void;
  onSave: () => void;
  onReset: () => void;
  onUsePlan: (p: Plan) => void;
  onPickStore: () => void;
  onNavigate: (v: ViewKey) => void;
}

/** 核价过程中的等待条。不伪造成分步打勾，只给不确定进度和一句实话。 */
function Working({ title }: { title: string }) {
  return (
    <Panel className="px-5 py-5 md:px-7">
      <div className="flex items-center gap-3.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50" aria-hidden="true">
          <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-[1.5px] border-brand-200 border-t-brand-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-ink">{title}</p>
          <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-ink/12">
            <div className="h-full w-1/3 animate-shimmer rounded-full bg-brand-300" />
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function OrderView({
  adjusting,
  result,
  selectedId,
  error,
  mode,
  storeName,
  plans,
  onSubmit,
  onSelect,
  onSave,
  onReset,
  onUsePlan,
  onPickStore,
  onNavigate,
}: OrderViewProps) {
  return (
    <div>
      <header className="max-w-[640px]">
        <p className="eyebrow">一句话调整 · 按门店实时核价</p>
        <h1 className="display mt-3 text-[27px] leading-[1.15] text-ink md:text-[34px]">
          {result ? '还想再改点什么？' : '说清楚这次要什么'}
        </h1>
        <p className="mt-2.5 max-w-[34rem] text-pretty text-[13px] leading-[1.9] text-ink-mute">
          {result
            ? '在刚才的结果上接着说，每改一次都会重新核价，价格与优惠都取门店实时结果。'
            : '可以整单照旧，也可以只改其中一两处。它会把这句话拆成结构化修改，而不是拿一句话去搜商品。'}
        </p>
      </header>

      <div className="mt-8 grid grid-cols-1 items-start gap-5 xl:mt-10 xl:grid-cols-[minmax(0,1fr)_288px]">
        {/* 主区 */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="px-5 py-6 md:px-7 md:py-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">{result ? '接着说' : '开始'}</p>
                <h2 className="display mt-2 text-[18px] text-ink md:text-[20px]">
                  {result ? '在这份结果上继续' : '用一句话说清'}
                </h2>
              </div>
              {result ? (
                <Button size="sm" onClick={onReset}>
                  重新开始
                </Button>
              ) : (
                <Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? '真实核价' : '演示'}</Badge>
              )}
            </div>
            <div className="mt-5">
              <Composer
                onSubmit={onSubmit}
                loading={adjusting}
                quickPrompts={result ? [] : QUICK_PROMPTS}
                compact={Boolean(result)}
                placeholder={result ? '还想改？接着说，比如「饮料换成无糖的」' : '还是上次那份，不过今天不要香芋派，预算不超过 16 元'}
              />
            </div>
          </Panel>

          {error ? (
            <Alert kind="error" title="没能完成这次调整" hint={error.hint}>
              {error.message}
            </Alert>
          ) : null}

          {adjusting ? <Working title={result ? '正在按新的说法重新核价…' : '正在解析你的说法，并查询门店真实菜单…'} /> : null}

          {result && !adjusting ? (
            <Panel className="px-5 py-6 md:px-7 md:py-8">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                  <p className="eyebrow">调整结果</p>
                  <h2 className="display mt-2 text-[20px] text-ink md:text-[23px]">这就是我要的那一份</h2>
                </div>
                <p className="max-w-[26rem] text-pretty text-[13px] leading-relaxed text-ink-faint">
                  {result.store.storeName || result.store.storeCode} · 基于
                  {result.baseFrom.kind === 'plan' ? '常用方案' : '最近一单'}「{result.baseFrom.name}」
                </p>
              </div>
              <div className="mt-6">
                <AdjustResultView result={result} selectedId={selectedId} onSelect={onSelect} onSave={onSave} />
              </div>
            </Panel>
          ) : null}

          {!result && !adjusting ? (
            <Panel className="flex min-h-[280px] items-center justify-center">
              <EmptyState
                title="先给它一句话"
                desc="说「还是老样子」直接复购；说「不要薯条」「饮料换无糖」「不超过 20 元」就在原方案上改。改完会按当前门店的真实菜单重新核价，再让你确认。"
                action={
                  <Button variant="primary" onClick={() => onSubmit('还是老样子')}>
                    <IconSparkle size={13} />
                    还是老样子
                  </Button>
                }
              />
            </Panel>
          ) : null}
        </div>

        {/* 右侧上下文 */}
        <aside className="flex flex-col gap-5">
          <Panel className="px-5 py-5">
            <p className="eyebrow">当前门店</p>
            <p className="mt-2.5 truncate text-[13px] text-ink">{storeName || '未选择门店'}</p>
            <p className="mt-1 text-[13px] text-ink-faint">到店自取 · {mode === 'live' ? '麦当劳 MCP 实时' : '演示数据'}</p>
            <Button size="sm" className="mt-4 w-full" onClick={onPickStore}>
              <IconStore size={12} />
              切换门店
            </Button>
          </Panel>

          <Panel className="px-5 py-5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="eyebrow">常用方案</p>
              <button
                type="button"
                onClick={() => onNavigate('plans')}
                className="group inline-flex items-center gap-1 text-[13px] text-ink-mute transition-colors duration-150 hover:text-brand-600"
              >
                全部
                <IconArrow size={9} className="transition-transform duration-150 group-hover:translate-x-0.5" />
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-faint">还没有常用方案。调好一单后可以存下来，下次一句话调出。</p>
            ) : (
              <ul className="mt-2 -mx-2">
                {plans.slice(0, 3).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => onUsePlan(p)}
                      className="group flex w-full items-center gap-2 rounded-2xl px-2 py-2 text-left transition-colors duration-150 hover:bg-gold-100"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] text-ink-soft group-hover:text-ink">{p.name}</span>
                        <span className="block truncate text-[11.5px] text-ink-faint">
                          {p.tag ?? '未分类'} · {p.items.length} 项
                        </span>
                      </span>
                      <IconArrow size={10} className="shrink-0 text-ink-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="px-5 py-5">
            <p className="eyebrow">可以这样说</p>
            <ul className="mt-2 -mx-2">
              {EXAMPLES.map((e) => (
                <li key={e.text}>
                  <button
                    type="button"
                    onClick={() => onSubmit(e.text)}
                    disabled={adjusting}
                    className="flex w-full items-baseline justify-between gap-2 rounded-2xl px-2 py-2 text-left transition-colors duration-150 hover:bg-gold-100 disabled:opacity-45"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">「{e.text}」</span>
                    <span className="shrink-0 text-[11.5px] text-ink-faint">{e.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
