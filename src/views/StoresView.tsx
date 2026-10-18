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
        <h1 className="display display-36 text-ink md:display-48">选择门店</h1>
        <p className="mt-3 max-w-[36rem] text-pretty text-[14.5px] font-medium leading-[1.8] text-ink-mute">
          同一份餐在不同门店价格不同，菜单与优惠也不同。
        </p>
      </header>

      <div className="mt-9 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_288px]">
        <Panel className="px-5 py-6 md:px-7 md:py-7">
          <p className="eyebrow">搜索门店</p>
          <h2 className="display display-24 mt-2 text-ink">城市 + 关键词</h2>
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
              <dd className="tnum mt-1 text-[13px] text-ink-soft">{currentStoreCode ?? '—'}</dd>
            </div>
            <div>
              <dt className="eyebrow">取餐方式</dt>
              <dd className="mt-1.5">
                <Badge tone="brand">到店自取</Badge>
              </dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
