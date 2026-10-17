import { useCallback, useEffect, useState } from 'react';
import { BE_TYPE_LABEL, type BeType, type PlanItem } from '../../server/domain/types';
import { api, ApiRequestError, type ConfirmResult, type PreviewResult } from '../api';
import { Alert, LoadingBlock, SectionHead } from './Common';
import { IconAlert, IconCheck, IconClose, IconReceipt, IconStore } from './Icons';

const yuan = (cents?: number) => (cents === undefined ? '—' : (cents / 100).toFixed(2));

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  storeCode: string;
  storeName: string;
  beType: BeType;
  items: PlanItem[];
  changeNotes: string[];
  mode: 'live' | 'demo';
  onOrdered: (result: ConfirmResult) => void;
}

/**
 * 订单确认。
 *
 * 这里是全流程里唯一会产生真实副作用的地方，所以视觉上只做一件事：
 * 把「门店 / 餐品 / 金额」三件事按顺序摆清楚，再让用户主动勾选。
 * 提交按钮在勾选之前一直是禁用态，这一点不能因为样式而弱化。
 */
export function ConfirmSheet({
  open,
  onClose,
  storeCode,
  storeName,
  beType,
  items,
  changeNotes,
  mode,
  onOrdered,
}: ConfirmSheetProps) {
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [checked, setChecked] = useState(false);
  const [takeWay, setTakeWay] = useState('');
  const [result, setResult] = useState<ConfirmResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setChecked(false);
    try {
      const p = await api.preview({ storeCode, beType, items });
      setPreview(p);
      setTakeWay(p.takeWayList[0]?.code ?? '');
    } catch (err) {
      const e = err as ApiRequestError;
      setError({ message: e.detail?.message ?? '生成订单预览失败', hint: e.detail?.hint });
    } finally {
      setLoading(false);
    }
  }, [storeCode, beType, items]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const submit = async () => {
    if (!preview || !checked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.confirm({ token: preview.token, takeWayCode: takeWay, confirmed: true });
      setResult(r);
      onOrdered(r);
    } catch (err) {
      const e = err as ApiRequestError;
      setError({ message: e.detail?.message ?? '下单失败', hint: e.detail?.hint });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="订单确认">
        <div className="sheet__head">
          <span className="sheet__mark">
            <IconReceipt size={17} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sheet__kicker">Checkout</div>
            <div className="sheet__title">确认这一单</div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="关闭">
            <IconClose />
          </button>
        </div>

        <div className="sheet__body">
          {loading && <LoadingBlock text="正在向官方核价…" />}

          {error && (
            <Alert kind="error" title="出了点问题" hint={error.hint}>
              {error.message}
            </Alert>
          )}

          {result && (
            <div className={`result-box${result.mode === 'demo' ? ' result-box--demo' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: 14 }}>
                <IconCheck size={16} />
                {result.mode === 'demo' ? '演示下单完成' : '订单已提交'}
              </div>
              {result.orderId && (
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 11.5, wordBreak: 'break-all' }}>
                  订单号 {result.orderId}
                </div>
              )}
              <div>{result.note}</div>
              {result.payUrl && (
                <a className="btn btn--primary btn--sm" href={result.payUrl} target="_blank" rel="noreferrer" style={{ marginTop: 6 }}>
                  去支付
                </a>
              )}
            </div>
          )}

          {preview && !result && (
            <>
              {/* 门店与来源：用户必须能确认「下到哪家店」 */}
              <div className="store-block">
                <IconStore size={15} />
                <div style={{ minWidth: 0 }}>
                  <div className="store-block__name">{storeName || `门店 ${storeCode}`}</div>
                  <div className="store-block__meta">
                    {BE_TYPE_LABEL[beType]} · {mode === 'demo' ? '演示数据，不会产生真实订单' : '麦当劳 MCP 实时'}
                  </div>
                </div>
              </div>

              <div>
                <div className="items">
                  {items.map((item, i) => {
                    // 金额按商品编码从官方核价结果里取；取不到就不显示金额，绝不猜
                    const line = preview.price.lines.find((l) => l.productCode === item.productCode);
                    return (
                      <div key={`${item.productCode}-${i}`} className="item-row">
                        <span className="item-row__qty">{item.quantity}×</span>
                        <span className="item-row__nm">{item.name}</span>
                        <span className="item-row__amt">{line ? `¥${yuan(line.subtotalCents)}` : ''}</span>
                        {item.children.length > 0 && (
                          <span className="item-row__kids">
                            {item.children.map((c) => `${c.roundName ? `${c.roundName}·` : ''}${c.name}`).join(' / ')}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 只有真的存在优惠时才展开原价/优惠明细；
                    否则它会和底部的「应付」变成两个一样的数字 */}
                {preview.price.discountCents > 0 && (
                  <div className="sums">
                    <div className="sums__row">
                      <span>商品原价</span>
                      <span>¥{yuan(preview.price.originalPriceCents)}</span>
                    </div>
                    <div className="sums__row sums__row--discount">
                      <span>优惠</span>
                      <span>−¥{yuan(preview.price.discountCents)}</span>
                    </div>
                  </div>
                )}
              </div>

              {changeNotes.length > 0 && (
                <div>
                  <SectionHead title="这次改的" />
                  <div className="cand__notes" style={{ borderTop: 0, paddingTop: 0, marginTop: -4 }}>
                    {changeNotes.map((n, i) => (
                      <div key={i} className="cand__note">
                        <IconCheck size={12} />
                        <span>{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <SectionHead title="取餐方式" />
                <div className="takeway-row">
                  {preview.takeWayList.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      className={`takeway${takeWay === t.code ? ' takeway--active' : ''}`}
                      onClick={() => setTakeWay(t.code)}
                    >
                      <div className="takeway__title">{t.title}</div>
                      <div className="takeway__sub">{t.subtitle}</div>
                    </button>
                  ))}
                </div>
              </div>

              {preview.priceChecks.length > 0 && (
                <div className="cand__notes" style={{ marginTop: 0, paddingTop: 0, borderTop: 0 }}>
                  {preview.priceChecks.map((n, i) => (
                    <div key={i} className="cand__note cand__note--warn">
                      <IconAlert size={12} />
                      <span>{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {preview && !result && (
          <div className="sheet__foot">
            <div className="foot-total">
              <span>应付</span>
              <span className="foot-total__value num">¥{yuan(preview.price.priceCents)}</span>
            </div>

            <p className="sheet__caveat">
              金额为官方接口实时核价，提交时可能因门店库存或活动变化产生微小差异，实际以门店出餐为准。
              {mode === 'demo' && ' 当前为演示数据，不会产生真实订单。'}
            </p>

            <label className="confirm-check">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              <span>
                我已核对门店、餐品与金额，确认提交这一单。
                <span className="muted">（系统不会在你确认前下单）</span>
              </span>
            </label>

            <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!checked || submitting} onClick={submit}>
              {submitting ? (
                <>
                  <div className="spinner" /> 提交中…
                </>
              ) : (
                <>
                  <IconCheck size={15} />
                  确认下单{mode === 'demo' ? '（演示）' : ''}
                </>
              )}
            </button>
          </div>
        )}

        {result && (
          <div className="sheet__foot">
            <button type="button" className="btn btn--ghost btn--block" onClick={onClose}>
              完成
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
