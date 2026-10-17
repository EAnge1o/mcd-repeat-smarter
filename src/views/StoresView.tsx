import type { BeType, Store } from '../../server/domain/types';
import { Badge, Panel } from '../components/ui';
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
    <div>
      <header className="max-w-[600px]">
        <p className="eyebrow">门店 · 菜单与价格的基础</p>
        <h1 className="display mt-3 text-[27px] leading-[1.15] text-ink md:text-[34px]">在哪家店取</h1>
        <p className="mt-2.5 max-w-[34rem] text-pretty text-[12.5px] leading-[1.9] text-ink-mute">
          门店决定菜单、价格与可选优惠。切换后方案与核价都会按新门店重算 —— 同一份餐在不同门店的价格本来就不一样。
        </p>
      </header>

      <div className="mt-9 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_288px]">
        <Panel className="px-5 py-6 md:px-7 md:py-7">
          <p className="eyebrow">搜索门店</p>
          <h2 className="display mt-2 text-[20px] text-ink">城市 + 关键词</h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-faint">
            官方接口需要「城市 + 关键词」才会返回真实在售菜单，只给关键词可能查不到。
          </p>
          <div className="mt-5">
            <StoreSearch defaultCity={defaultCity} beType={beType} currentStoreCode={currentStoreCode} onPick={onPick} />
          </div>
        </Panel>

        <Panel className="px-5 py-6 md:px-6">
          <p className="eyebrow">当前门店</p>
          <p className="mt-3 text-[14px] leading-snug text-ink">{currentStoreName || '未选择'}</p>

          <dl className="mt-5 space-y-3.5">
            <div>
              <dt className="eyebrow">门店编码</dt>
              <dd className="tnum mt-1 font-mono text-[12px] text-ink-soft">{currentStoreCode ?? '—'}</dd>
            </div>
            <div>
              <dt className="eyebrow">取餐方式</dt>
              <dd className="mt-1.5">
                <Badge tone="brand">到店自取</Badge>
              </dd>
            </div>
          </dl>

          <p className="mt-6 border-t border-hair pt-4 text-[10.5px] leading-relaxed text-ink-faint">
            这一单会下到这家店。改店之后，之前核过的价格作废，需要重新核一次。
          </p>
        </Panel>
      </div>
    </div>
  );
}
