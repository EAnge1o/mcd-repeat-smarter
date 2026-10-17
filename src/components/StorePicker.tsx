import { useState } from 'react';
import type { BeType, Store } from '../../server/domain/types';
import { api, ApiRequestError } from '../api';
import { Alert, EmptyState, LoadingBlock } from './Common';
import { IconArrow, IconClose, IconStore } from './Icons';

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
  const [city, setCity] = useState(defaultCity);
  const [keyword, setKeyword] = useState('');
  const [stores, setStores] = useState<Store[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

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
    <div className="modal" onClick={onClose} role="presentation">
      <div className="modal__box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="选择门店">
        <div className="modal__head">
          <IconStore />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>选择门店</div>
            <div className="tiny muted">门店会决定菜单、价格和可选优惠</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <IconClose />
          </button>
        </div>

        <div className="modal__body">
          <div style={{ display: 'flex', gap: 8 }}>
            <div className="field" style={{ width: 110 }}>
              <label htmlFor="city">城市</label>
              <input id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="kw">商圈 / 地标</label>
              <input
                id="kw"
                className="input"
                value={keyword}
                placeholder="例如 南京东路、科技园"
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void search();
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button type="button" className="btn btn--primary" onClick={() => void search()} disabled={loading}>
                {loading ? <div className="spinner" /> : '搜索'}
              </button>
            </div>
          </div>

          {error && <Alert kind="warn">{error}</Alert>}
          {loading && <LoadingBlock text="正在查询附近门店…" />}

          {stores && stores.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stores.map((s) => (
                <button
                  key={s.storeCode}
                  type="button"
                  className={`store-option${s.storeCode === currentStoreCode ? ' store-option--active' : ''}`}
                  onClick={() => {
                    onPick(s);
                    onClose();
                  }}
                >
                  <IconStore size={17} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="store-option__name">{s.storeName}</div>
                    <div className="store-option__addr">{s.address}</div>
                  </div>
                  {s.distance !== undefined && <span className="store-option__dist">{s.distance}m</span>}
                  <IconArrow size={13} />
                </button>
              ))}
            </div>
          )}

          {!loading && stores === null && (
            <EmptyState
              icon={<IconStore size={20} />}
              title="先搜索一家门店"
              desc="MCP 的门店查询需要「城市 + 关键词」，这样才能拿到这家店真实的在售菜单和价格。"
            />
          )}
        </div>
      </div>
    </div>
  );
}
