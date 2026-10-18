import type { Plan } from '../../server/domain/types';
import { Button, EmptyState, MetricLead, MetricPair, Panel } from '../components/ui';
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
          <h1 className="display display-36 text-ink md:display-48">常用方案</h1>
          <p className="mt-3 max-w-[36rem] text-pretty text-[14.5px] font-medium leading-[1.8] text-ink-mute">
            说一句「还是老样子」就能整单调出来。
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate('order')}>
          <IconSparkle size={13} />
          调一单新的
        </Button>
      </header>

      <section aria-label="方案概况" className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <MetricLead label="存下的方案" value={`${plans.length}`} unit="个" loading={loading} />
          <MetricPair
            loading={loading}
            items={[
              { label: '分类', value: `${tags.length} 类` },
              { label: '涉及门店', value: `${new Set(plans.map((p) => p.storeCode)).size} 家` },
              { label: '数据来源', value: mode === 'live' ? '真实接口' : '演示数据' },
            ]}
          />
        </div>
        <div className="hair mt-7" aria-hidden="true" />
      </section>

      <Panel className="mt-6 px-5 py-6 md:px-8 md:py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="eyebrow">全部方案</p>
            <h2 className="display display-24 mt-2 text-ink">点「用它」整单复用</h2>
          </div>
          <p className="tnum text-[11.5px] text-ink-mute">{plans.length} 个</p>
        </div>

        <div className="mt-5">
          {loading ? (
            <PlansGrid plans={[]} loading onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} />
          ) : plans.length === 0 ? (
            <EmptyState
              title="还没有保存的常用方案"
              desc="调好一单后点「存成常用方案」。"
              action={
                <Button variant="primary" size="sm" onClick={() => onNavigate('order')}>
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
