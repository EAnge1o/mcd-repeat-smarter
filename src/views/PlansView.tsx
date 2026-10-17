import type { Plan } from '../../server/domain/types';
import { Button, EmptyState, Panel, Stat } from '../components/ui';
import { PlansGrid } from '../components/PlansGrid';
import { IconSparkle } from '../components/Icons';
import type { ViewKey } from '../components/Sidebar';

export function PlansView({
  plans,
  loading,
  mode,
  onUse,
  onDelete,
  onDuplicate,
  onRename,
  onNavigate,
}: {
  plans: Plan[];
  loading: boolean;
  mode: 'live' | 'demo';
  onUse: (p: Plan) => void;
  onDelete: (p: Plan) => void;
  onDuplicate: (p: Plan) => void;
  onRename: (p: Plan) => void;
  onNavigate: (v: ViewKey) => void;
}) {
  const tags = [...new Set(plans.map((p) => p.tag).filter(Boolean))] as string[];

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="max-w-[560px]">
          <p className="eyebrow">常用方案 · 结构化编码</p>
          <h1 className="display mt-3 text-[27px] leading-[1.15] text-ink md:text-[34px]">存下来的那些单</h1>
          <p className="mt-2.5 max-w-[34rem] text-pretty text-[12.5px] leading-[1.9] text-ink-mute">
            方案存的是商品编码，不是一句话。价格每次下单前都会按门店重新核，所以这里的数字只代表「当时那一单」。
          </p>
        </div>
        <Button variant="primary" arrow onClick={() => onNavigate('order')}>
          <IconSparkle size={13} />
          调一单新的
        </Button>
      </header>

      <section aria-label="方案概况" className="mt-9 border-y border-hair">
        <dl className="grid grid-cols-2 md:grid-cols-4">
          <div className="py-6 md:pl-0 md:pr-7">
            <Stat label="方案总数" value={String(plans.length)} unit="个" />
          </div>
          <div className="border-l border-hair px-4 py-6 md:px-7">
            <Stat label="分类数" value={String(tags.length)} unit="类" />
          </div>
          <div className="border-t border-hair py-6 md:border-l md:border-t-0 md:pl-7 md:pr-0">
            <Stat label="涉及门店" value={String(new Set(plans.map((p) => p.storeCode)).size)} unit="家" />
          </div>
          <div className="border-l border-t border-hair px-4 py-6 md:border-t-0 md:pl-7 md:pr-0">
            <Stat label="数据来源" value={mode === 'live' ? 'MCP' : '演示'} hint={mode === 'live' ? '真实接口' : '内置示例'} />
          </div>
        </dl>
      </section>

      <Panel className="mt-6 px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">全部方案</p>
            <h2 className="display mt-2 text-[20px] text-ink md:text-[23px]">点「用它」直接整单复用</h2>
          </div>
          <p className="tnum font-mono text-[10px] text-ink-faint">{plans.length} 个</p>
        </div>

        <div className="mt-5">
          {loading ? (
            <PlansGrid plans={[]} loading onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} />
          ) : plans.length === 0 ? (
            <EmptyState
              title="还没有保存的常用方案"
              desc="调好一单后点「存成常用方案」，它会出现在这里。下次说一句「还是老样子」，就能把它整单调出来。"
              action={
                <Button variant="primary" size="sm" arrow onClick={() => onNavigate('order')}>
                  去调一单
                </Button>
              }
            />
          ) : (
            <PlansGrid plans={plans} onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} />
          )}
        </div>
      </Panel>
    </div>
  );
}
