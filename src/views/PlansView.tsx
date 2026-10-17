import type { Plan } from '../../server/domain/types';
import { Button, Card, CardHead, EmptyState } from '../components/ui';
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
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#111827] md:text-2xl">常用方案</h1>
          <p className="mt-1 text-xs text-[#6b6862]">
            方案存的是商品编码，不是一句话。价格每次下单前都会按门店重新核。
          </p>
        </div>
        <Button variant="primary" onClick={() => onNavigate('order')}>
          <IconSparkle size={14} />
          调一单新的
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        {[
          { label: '方案总数', value: String(plans.length) },
          { label: '分类数', value: String(tags.length) },
          { label: '涉及门店', value: String(new Set(plans.map((p) => p.storeCode)).size) },
          { label: '数据来源', value: mode === 'live' ? 'MCP' : '演示' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
            <p className="text-[11px] text-[#8a877f]">{s.label}</p>
            <p className="tnum mt-1 text-[18px] font-semibold leading-none text-[#111827]">{s.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHead
          title="全部方案"
          desc="点「用它」直接整单复用，或在此基础上继续改"
          action={<span className="tnum text-[11px] text-[#a8a49c]">{plans.length} 个</span>}
        />
        {loading ? (
          <PlansGrid plans={[]} loading onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} />
        ) : plans.length === 0 ? (
          <EmptyState
            title="还没有保存的常用方案"
            desc="调好一单后点「存成常用方案」，它会出现在这里。下次说一句「还是老样子」，就能把它整单调出来。"
            action={
              <Button variant="primary" size="sm" onClick={() => onNavigate('order')}>
                去调一单
              </Button>
            }
          />
        ) : (
          <PlansGrid plans={plans} onUse={onUse} onDelete={onDelete} onDuplicate={onDuplicate} onRename={onRename} />
        )}
      </Card>
    </div>
  );
}
