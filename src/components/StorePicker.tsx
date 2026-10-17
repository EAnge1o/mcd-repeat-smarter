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
          <label htmlFor="city" className="mb-1 block text-[11px] text-[#6b6862]">
            城市
          </label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-9 w-full rounded-lg border border-line bg-[#faf9f7] px-2.5 text-sm text-[#111827] transition-all duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <div className="sm:flex-1">
          <label htmlFor="kw" className="mb-1 block text-[11px] text-[#6b6862]">
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
            className="h-9 w-full rounded-lg border border-line bg-[#faf9f7] px-2.5 text-sm text-[#111827] transition-all duration-150 placeholder:text-[#a8a49c] focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <Button variant="primary" onClick={() => void search()} disabled={loading} className="shrink-0">
          {loading ? <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/35 border-t-white" /> : <IconSearch size={14} />}
          搜索
        </Button>
      </div>

      {error ? <Alert kind="warn" title={error} /> : null}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-lg border border-line p-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
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
                    'flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all duration-150 ease-out',
                    active
                      ? 'border-brand-500 bg-brand-50/40'
                      : 'border-line bg-white hover:border-[#d8d4cd] hover:bg-[#faf9f7]',
                  )}
                >
                  <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', active ? 'bg-brand-100 text-brand-700' : 'bg-[#f2f0ec] text-[#8a877f]')}>
                    <IconStore size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-[#111827]">{s.storeName}</span>
                    <span className="block truncate text-[11px] text-[#8a877f]">{s.address}</span>
                  </span>
                  {s.distance !== undefined ? <span className="tnum shrink-0 text-[11px] text-[#a8a49c]">{s.distance}m</span> : null}
                  <IconArrow size={12} className="shrink-0 text-[#c0bcb4]" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && stores === null ? (
        <EmptyState
          title="先搜索一家门店"
          desc="MCP 的门店查询需要「城市 + 关键词」，这样才能拿到这家店真实的在售菜单和价格。"
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="选择门店"
        className="flex max-h-[88vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3 md:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600" aria-hidden="true">
            <IconStore size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-[#111827]">选择门店</h2>
            <p className="text-[11px] text-[#8a877f]">门店会决定菜单、价格和可选优惠</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8a877f] transition-colors duration-150 hover:bg-[#f2f0ec] hover:text-[#3d3a35]"
          >
            <IconClose size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-4 md:px-5">
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
