import { useCallback, useEffect, useState } from 'react';
import { BE_TYPE_LABEL, type BeType, type PlanItem } from '../../server/domain/types';
import { api, ApiRequestError, type ConfirmResult, type PreviewResult } from '../api';
import { Alert, LoadingBlock } from './Common';
import { IconAlert, IconCheck, IconClose, IconReceipt } from './Icons';

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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                <IconCheck size={16} />
                {result.mode === 'demo' ? '演示下单完成' : '订单已提交'}
              </div>
              {result.orderId && (
                <div className="tiny" style={{ fontFamily: 'var(--font-num)', wordBreak: 'break-all' }}>
                  订单号 {result.orderId}
                </div>
              )}
              <div className="tiny">{result.note}</div>
              {result.payUrl && (
                <a className="btn btn--primary" href={result.payUrl} target="_blank" rel="noreferrer" style={{ marginTop: 4 }}>
                  去支付
                </a>
              )}
            </div>
          )}

          {preview && !result && (
            <>
              <div className="card" style={{ padding: '16px 18px' }}>
                <div className="kv">
                  <span>门店</span>
                  <span style={{ fontWeight: 600 }}>{storeName || storeCode}</span>
                </div>
                <div className="kv">
                  <span>点餐方式</span>
                  <span style={{ fontWeight: 600 }}>
                    {BE_TYPE_LABEL[beType]}
                    {mode === 'demo' ? '（演示）' : ''}
                  </span>
                </div>
                <div className="kv">
                  <span>数据来源</span>
                  <span>{mode === 'demo' ? '演示数据（非真实）' : '麦当劳 MCP 实时'}</span>
                </div>
              </div>

              <div>
                <div className="section-title">
                  <h2>餐品清单</h2>
                  <span className="section-title__hint">{preview.price.lines.reduce((n, l) => n + l.quantity, 0)} 件</span>
                </div>
                <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {items.map((item, i) => {
                    // 金额按商品编码从官方核价结果里取；取不到就不显示金额，绝不猜
                    const line = preview.price.lines.find((l) => l.productCode === item.productCode);
                    return (
                      <div key={`${item.productCode}-${i}`} className="line-item">
                        <span className="line-item__qty">{item.quantity}</span>
                        <div className="line-item__body" style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <span className="line-item__name">{item.name}</span>
                            {item.children.length > 0 && (
                              <div className="line-item__children">
                                {item.children.map((c, j) => (
                                  <span key={j} className="child-tag">
                                    {c.roundName ? `${c.roundName}·` : ''}
                                    {c.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          {line && (
                            <span className="num" style={{ flex: '0 0 auto', color: 'var(--ink-600)' }}>
                              ¥{yuan(line.subtotalCents)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {changeNotes.length > 0 && (
                <div>
                  <div className="section-title">
                    <h2>你改动的内容</h2>
                  </div>
                  <div className="candidate__explain">
                    {changeNotes.map((n, i) => (
                      <div key={i}>{n}</div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="section-title">
                  <h2>取餐方式</h2>
                </div>
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

              <div className="receipt" style={{ padding: '18px 20px 24px' }}>
                <div className="receipt__label" style={{ marginBottom: 8 }}>
                  Amount due
                </div>
                <div className="kv" style={{ paddingTop: 0 }}>
                  <span>商品原价</span>
                  <span className="num">¥{yuan(preview.price.originalPriceCents)}</span>
                </div>
                {preview.price.discountCents > 0 && (
                  <div className="kv" style={{ color: 'var(--green-700)' }}>
                    <span>优惠</span>
                    <span className="num">−¥{yuan(preview.price.discountCents)}</span>
                  </div>
                )}
                <div className="total-row">
                  <span className="total-row__label">应付</span>
                  <span className="total-row__value">¥{yuan(preview.price.priceCents)}</span>
                </div>
              </div>

              {preview.priceChecks.length > 0 && (
                <div className="check-row">
                  <IconAlert size={15} />
                  <span>{preview.priceChecks.join('；')}</span>
                </div>
              )}

            </>
          )}
        </div>

        {preview && !result && (
          <div className="sheet__foot">
            <div className="foot-total">
              <span>应付</span>
              <span className="foot-total__value">¥{yuan(preview.price.priceCents)}</span>
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
            <button type="button" className="btn btn--primary btn--block" disabled={!checked || submitting} onClick={submit}>
              {submitting ? (
                <>
                  <div className="spinner" /> 提交中…
                </>
              ) : (
                <>确认下单{mode === 'demo' ? '（演示）' : ''}</>
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
