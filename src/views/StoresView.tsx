import type { BeType, Store } from '../../server/domain/types';
import { Badge, Card, CardHead } from '../components/ui';
import { StoreSearch } from '../components/StorePicker';

export function StoresView({
  defaultCity,
  beType,
  currentStoreCode,
  currentStoreName,
  onPick,
}: {
  defaultCity: string;
  beType: BeType;
  currentStoreCode?: string;
  currentStoreName: string;
  onPick: (s: Store) => void;
}) {
  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-[#111827] md:text-2xl">门店</h1>
        <p className="mt-1 text-xs text-[#6b6862]">门店决定菜单、价格与可选优惠。切换后方案与核价都会按新门店重算。</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHead title="搜索门店" desc="MCP 需要「城市 + 关键词」才能返回真实在售菜单" />
          <div className="p-3.5 md:p-4">
            <StoreSearch defaultCity={defaultCity} beType={beType} currentStoreCode={currentStoreCode} onPick={onPick} />
          </div>
        </Card>

        <Card>
          <CardHead title="当前门店" desc="这一单会下到这家店" />
          <div className="space-y-2.5 px-4 py-3.5 md:px-5">
            <div>
              <p className="text-[11px] text-[#8a877f]">门店名称</p>
              <p className="mt-0.5 truncate text-[13px] font-medium text-[#111827]">{currentStoreName || '未选择'}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#8a877f]">门店编码</p>
              <p className="tnum mt-0.5 font-mono text-[12px] text-[#4b4945]">{currentStoreCode ?? '—'}</p>
            </div>
            <div>
              <p className="text-[11px] text-[#8a877f]">取餐方式</p>
              <div className="mt-1">
                <Badge tone="brand">到店自取</Badge>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
