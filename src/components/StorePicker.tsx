import { useState } from 'react';
import type { BeType, Store } from '../../server/domain/types';
import { api, ApiRequestError } from '../api';
import { Alert, Button, EmptyState, Skeleton, cx } from './ui';
import { IconArrow, IconClose, IconSearch, IconStore } from './Icons';

interface SearchProps {
  defaultCity: string;
  beType: BeType;
  currentStoreCode?: string;
  onPick: (store: Store) => void;
}

/** 门店搜索主体。弹层和「门店」页共用同一份，避免两处逻辑各写一遍。 */
export function StoreSearch({ defaultCity, beType, currentStoreCode, onPick }: SearchProps) {
  const [city, setCity] = useState(defaultCity);
  const [keyword, setKeyword] = useState('');
  const [stores, setStores] = useState<Store[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!keyword.trim()) {
      setError('请填写商圈或地标名，例如「南京东路」');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.stores(city, keyword, beType);
      setStores(r.stores);
      if (r.stores.length === 0) setError('这个关键词没有搜到门店，换个地标试试');
    } catch (err) {
      const e = err as ApiRequestError;
      setError(e.detail?.message ?? '搜索门店失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="sm:w-28">
          <label htmlFor="city" className="eyebrow mb-1.5 block">
            城市
          </label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-10 w-full rounded-2xl bg-ink/5 px-3 text-[13px] text-ink outline-none ring-1 ring-inset ring-transparent transition-all duration-150 focus:bg-white focus:ring-brand-300"
          />
        </div>

        <div className="sm:flex-1">
          <label htmlFor="kw" className="eyebrow mb-1.5 block">
            商圈 / 地标
          </label>
          <input
            id="kw"
            value={keyword}
            placeholder="例如 南京东路、科技园"
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
            className="h-10 w-full rounded-2xl bg-ink/5 px-3 text-[13px] text-ink outline-none ring-1 ring-inset ring-transparent transition-all duration-150 placeholder:text-ink-faint focus:bg-white focus:ring-brand-300"
          />
        </div>

        <Button variant="primary" onClick={() => void search()} disabled={loading} className="h-10 shrink-0">
          {loading ? <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" /> : <IconSearch size={13} />}
          搜索
        </Button>
      </div>

      {error ? <Alert kind="warn" title={error} /> : null}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-2xl bg-[#fbf7f3] p-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="mt-1.5 h-2.5 w-48" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {stores && stores.length > 0 ? (
        <ul className="space-y-1.5">
          {stores.map((s) => {
            const active = s.storeCode === currentStoreCode;
            return (
              <li key={s.storeCode}>
                <button
                  type="button"
                  onClick={() => onPick(s)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-150 ease-out',
                    active
                      ? 'bg-wash ring-1 ring-inset ring-brand-200'
                      : 'bg-[#fbf7f3] ring-1 ring-inset ring-transparent hover:bg-[#f8f2ec]',
                  )}
                >
                  <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full', active ? 'bg-white text-brand-600' : 'bg-white/80 text-ink-mute')}>
                    <IconStore size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{s.storeName}</span>
                    <span className="block truncate text-[13px] text-ink-faint">{s.address}</span>
                  </span>
                  {/* 营业状态决定这家店能不能核价，必须在列表里就写清楚，
                      否则用户只能靠「下单失败」反推自己选了一家休息的店 */}
                  <span className="shrink-0 text-right">
                    {s.businessStatus ? (
                      <span className="block text-[11.5px] leading-[1.5] tracking-[0.08em] text-[#3f6b52]">
                        营业中
                        {s.businessEndTime ? <span className="block text-ink-faint">至 {s.businessEndTime}</span> : null}
                      </span>
                    ) : (
                      <span className="block text-[11.5px] leading-[1.5] tracking-[0.08em] text-ink-faint">
                        休息中
                        {s.businessStartTime ? <span className="block text-ink-faint">{s.businessStartTime} 起</span> : null}
                      </span>
                    )}
                  </span>
                  {s.distance !== undefined ? (
                    <span className="tnum shrink-0 text-[11.5px] text-ink-faint">{s.distance}m</span>
                  ) : null}
                  <IconArrow size={11} className="shrink-0 text-ink-faint" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && stores === null ? (
        <EmptyState
          compact
          title="先搜索一家门店"
          desc="填城市 + 关键词才能查到。"
        />
      ) : null}
    </div>
  );
}

export function StorePicker({
  open,
  onClose,
  onPick,
  currentStoreCode,
  defaultCity,
  beType,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (store: Store) => void;
  currentStoreCode?: string;
  defaultCity: string;
  beType: BeType;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2b201b]/30 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="选择门店"
        className="animate-fade-up flex max-h-[88vh] w-full max-w-[580px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-float sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-hair px-6 py-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
            <IconStore size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">切换门店</p>
            <h2 className="display display-24 mt-1.5 text-ink">在哪家店取</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-mute">门店会决定菜单、价格和可选优惠</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors duration-150 hover:bg-ink/8 hover:text-ink"
          >
            <IconClose size={15} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <StoreSearch
            defaultCity={defaultCity}
            beType={beType}
            currentStoreCode={currentStoreCode}
            onPick={(s) => {
              onPick(s);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
