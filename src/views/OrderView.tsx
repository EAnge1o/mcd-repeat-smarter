import type { Plan } from '../../server/domain/types';
import type { AdjustResult } from '../api';
import { Alert, Badge, Button, Card, CardHead, EmptyState } from '../components/ui';
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

/** 核价过程中的等待卡。不伪造成分步打勾，只给真实秒数和不确定进度条。 */
function Working({ title }: { title: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3.5 md:px-5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-50" aria-hidden="true">
          <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-brand-200 border-t-brand-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-[#111827]">{title}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[#f2f0ec]">
            <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-brand-400" />
          </div>
        </div>
      </div>
    </Card>
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
    <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      {/* 主区 */}
      <div className="flex min-w-0 flex-col gap-3 md:gap-4">
        <Card>
          <CardHead
            title={result ? '接着说' : '用一句话说清这次要什么'}
            desc={result ? '在刚才的结果上继续改，每次都会重新核价' : '可以整单照旧，也可以只改其中一两处'}
            action={
              result ? (
                <Button size="sm" onClick={onReset}>
                  重新开始
                </Button>
              ) : (
                <Badge tone={mode === 'live' ? 'ok' : 'warn'}>{mode === 'live' ? '真实核价' : '演示'}</Badge>
              )
            }
          />
          <div className="p-3.5 md:p-4">
            <Composer
              onSubmit={onSubmit}
              loading={adjusting}
              quickPrompts={result ? [] : QUICK_PROMPTS}
              compact={Boolean(result)}
              placeholder={result ? '还想改？接着说，比如「饮料换成无糖的」' : '还是上次那份，不过今天不要香芋派，预算不超过 16 元'}
            />
          </div>
        </Card>

        {error ? (
          <Alert kind="error" title="没能完成这次调整" hint={error.hint}>
            {error.message}
          </Alert>
        ) : null}

        {adjusting ? <Working title={result ? '正在按新的说法重新核价…' : '正在解析你的说法，并查询门店真实菜单…'} /> : null}

        {result && !adjusting ? (
          <Card>
            <CardHead
              title="调整结果"
              desc={`${result.store.storeName || result.store.storeCode} · 基于${
                result.baseFrom.kind === 'plan' ? '常用方案' : '最近一单'
              }「${result.baseFrom.name}」`}
            />
            <div className="p-3.5 md:p-4">
              <AdjustResultView result={result} selectedId={selectedId} onSelect={onSelect} onSave={onSave} />
            </div>
          </Card>
        ) : null}

        {!result && !adjusting ? (
          <Card className="flex flex-1 items-center justify-center">
            <EmptyState
              title="先说一句话，我把它算成一份具体的单"
              desc="说「还是老样子」直接复购；说「不要薯条」「饮料换无糖」「不超过 20 元」就在原方案上改。改完会按当前门店的真实菜单重新核价，再让你确认。"
              action={
                <Button variant="primary" onClick={() => onSubmit('还是老样子')}>
                  <IconSparkle size={14} />
                  还是老样子
                </Button>
              }
            />
          </Card>
        ) : null}
      </div>

      {/* 右侧上下文：门店、常用方案、示例说法 */}
      <aside className="space-y-3 md:space-y-4">
        <Card>
          <CardHead title="当前门店" desc="决定菜单、价格与可选优惠" />
          <div className="px-4 py-3 md:px-5">
            <p className="truncate text-[12.5px] font-medium text-[#111827]">{storeName || '未选择门店'}</p>
            <p className="mt-0.5 text-[11px] text-[#8a877f]">到店自取 · {mode === 'live' ? '麦当劳 MCP 实时' : '演示数据'}</p>
            <Button size="sm" className="mt-2.5 w-full" onClick={onPickStore}>
              <IconStore size={12} />
              切换门店
            </Button>
          </div>
        </Card>

        <Card>
          <CardHead
            title="常用方案"
            desc="点一下直接整单复用"
            action={
              <Button size="sm" onClick={() => onNavigate('plans')}>
                全部
              </Button>
            }
          />
          {plans.length === 0 ? (
            <EmptyState compact title="还没有常用方案" desc="调好一单后可以存下来，下次一句话调出。" />
          ) : (
            <ul className="divide-y divide-line">
              {plans.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onUsePlan(p)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[#faf9f7] md:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-[#111827]">{p.name}</span>
                      <span className="block truncate text-[10px] text-[#a8a49c]">
                        {p.tag ?? '未分类'} · {p.items.length} 项
                      </span>
                    </span>
                    <IconArrow size={11} className="shrink-0 text-[#c0bcb4]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="可以这样说" desc="点一下直接试" />
          <ul className="divide-y divide-line">
            {EXAMPLES.map((e) => (
              <li key={e.text}>
                <button
                  type="button"
                  onClick={() => onSubmit(e.text)}
                  disabled={adjusting}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors duration-150 hover:bg-[#faf9f7] disabled:opacity-50 md:px-5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-[#111827]">「{e.text}」</span>
                    <span className="block truncate text-[10px] text-[#a8a49c]">{e.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </aside>
    </div>
  );
}
