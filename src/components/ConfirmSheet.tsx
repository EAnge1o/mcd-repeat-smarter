import { useCallback, useEffect, useState } from 'react';
import { BE_TYPE_LABEL, type BeType, type PlanItem } from '../../server/domain/types';
import { api, ApiRequestError, type ConfirmResult, type PreviewResult } from '../api';
import { Alert, Badge, Button, Skeleton, cx } from './ui';
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
 * 订单确认弹层。
 *
 * 这是全流程唯一会产生真实副作用的地方，所以视觉上只做一件事：
 * 把「门店 / 餐品 / 金额」按顺序摆清楚，再让用户主动勾选。
 * 提交按钮在勾选之前一直是禁用态 —— 这条不能因为样式调整而弱化成「看起来能点」。
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#2b201b]/30 p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="订单确认"
        className="animate-fade-up flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-float sm:rounded-[28px]"
      >
        {/* 头 */}
        <div className="flex shrink-0 items-start gap-3 border-b border-hair px-6 py-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
            <IconReceipt size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">最后一步</p>
            <h2 className="display mt-1.5 text-[19px] text-ink">确认这一单</h2>
            <p className="mt-0.5 text-[11px] text-ink-mute">提交前请核对门店、餐品与金额</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint transition-colors duration-200 hover:bg-[#f6f1ec] hover:text-ink"
          >
            <IconClose size={15} />
          </button>
        </div>

        {/* 主体 */}
        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-24 w-full rounded-2xl" />
              <Skeleton className="h-10 w-full rounded-2xl" />
            </div>
          ) : null}

          {error ? (
            <Alert kind="error" title="出了点问题" hint={error.hint}>
              {error.message}
            </Alert>
          ) : null}

          {result ? (
            <div className="rounded-2xl bg-sage px-4 py-4 ring-1 ring-inset ring-[#d9e8de]">
              <p className="flex items-center gap-2 text-[13px] text-[#2f5641]">
                <IconCheck size={15} />
                {result.mode === 'demo' ? '演示下单完成' : '订单已提交'}
              </p>
              {result.orderId ? (
                <p className="mt-1.5 break-all font-mono text-[10.5px] text-[#3f6b52]">订单号 {result.orderId}</p>
              ) : null}
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#3f6b52]">{result.note}</p>
              {result.payUrl ? (
                <a
                  href={result.payUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-[11.5px] font-medium text-white transition-colors duration-200 hover:bg-[#3a312c]"
                >
                  去支付
                </a>
              ) : null}
            </div>
          ) : null}

          {preview && !result ? (
            <>
              {/* 门店与来源：用户必须能确认「下到哪家店」 */}
              <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
                <IconStore size={15} className="shrink-0 text-ink-mute" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-ink">{storeName || `门店 ${storeCode}`}</p>
                  <p className="truncate text-[10.5px] text-ink-faint">
                    {BE_TYPE_LABEL[beType]} · {mode === 'demo' ? '演示数据，不会产生真实订单' : '麦当劳 MCP 实时'}
                  </p>
                </div>
              </div>

              {/* 餐品 */}
              <div className="overflow-hidden rounded-2xl bg-[#fbf7f3]">
                <ul className="divide-y divide-hair">
                  {items.map((item, i) => {
                    // 金额按商品编码从官方核价结果里取；取不到就不显示金额，绝不猜
                    const line = preview.price.lines.find((l) => l.productCode === item.productCode);
                    return (
                      <li key={`${item.productCode}-${i}`} className="flex items-baseline gap-2.5 px-4 py-2.5">
                        <span className="tnum shrink-0 font-mono text-[10px] text-ink-faint">{item.quantity}×</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-ink">{item.name}</span>
                          {item.children.length > 0 ? (
                            <span className="mt-1 block truncate text-[10px] text-ink-faint">
                              {item.children.map((c) => `${c.roundName ? `${c.roundName}·` : ''}${c.name}`).join(' / ')}
                            </span>
                          ) : null}
                        </span>
                        <span className="tnum display shrink-0 text-[11.5px] text-ink-soft">{line ? `¥${yuan(line.subtotalCents)}` : ''}</span>
                      </li>
                    );
                  })}
                </ul>

                {/* 只有真的存在优惠时才展开原价/优惠明细；
                    否则它会和底部的「应付」变成两个一样的数字 */}
                {preview.price.discountCents > 0 ? (
                  <div className="space-y-1 border-t border-hair bg-white/70 px-4 py-2.5 text-[11.5px]">
                    <div className="flex justify-between text-ink-mute">
                      <span>商品原价</span>
                      <span className="tnum">¥{yuan(preview.price.originalPriceCents)}</span>
                    </div>
                    <div className="flex justify-between text-[#3f6b52]">
                      <span>优惠</span>
                      <span className="tnum">−¥{yuan(preview.price.discountCents)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {changeNotes.length > 0 ? (
                <div>
                  <p className="eyebrow mb-2">这次改的</p>
                  <ul className="space-y-1">
                    {changeNotes.map((n, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-soft">
                        <IconCheck size={11} className="mt-0.5 shrink-0 text-[#3f6b52]" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="eyebrow mb-2">取餐方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {preview.takeWayList.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => setTakeWay(t.code)}
                      aria-pressed={takeWay === t.code}
                      className={cx(
                        'rounded-2xl px-3 py-2.5 text-left transition-[background-color,box-shadow] duration-200 ease-out',
                        takeWay === t.code
                          ? 'bg-blush ring-1 ring-inset ring-brand-300'
                          : 'bg-[#fbf7f3] ring-1 ring-inset ring-transparent hover:bg-[#f8f2ec]',
                      )}
                    >
                      <span className="block truncate text-[12px] text-ink">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-ink-faint">{t.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>

              {preview.priceChecks.length > 0 ? (
                <ul className="space-y-1">
                  {preview.priceChecks.map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-[#7a5a1c]">
                      <IconAlert size={11} className="mt-0.5 shrink-0" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>

        {/* 底 */}
        {preview && !result ? (
          <div className="shrink-0 border-t border-hair bg-[#fffdfc] px-6 py-4">
            <div className="flex items-baseline justify-between">
              <span className="flex items-center gap-2 text-[11px] text-ink-mute">
                应付
                {mode === 'demo' ? <Badge tone="warn">演示</Badge> : null}
              </span>
              <span className="tnum display text-[27px] leading-none text-ink">
                <span className="mr-1 font-sans text-[13px] font-normal text-ink-faint">¥</span>
                {yuan(preview.price.priceCents)}
              </span>
            </div>

            <p className="mt-2.5 text-[10px] leading-relaxed text-ink-faint">
              金额为官方接口实时核价，提交时可能因门店库存或活动变化产生微小差异，实际以门店出餐为准。
              {mode === 'demo' ? ' 当前为演示数据，不会产生真实订单。' : ''}
            </p>

            <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-[#fbf7f3] px-3.5 py-2.5">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 h-3.5 w-3.5 shrink-0 accent-brand-500"
              />
              <span className="text-[11.5px] leading-relaxed text-ink-soft">
                我已核对门店、餐品与金额，确认提交这一单。
                <span className="text-ink-faint">（系统不会在你确认前下单）</span>
              </span>
            </label>

            <Button
              variant="primary"
              size="lg"
              arrow
              className="mt-3 w-full"
              disabled={!checked || submitting}
              onClick={() => void submit()}
            >
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/30 border-t-white" />
                  提交中…
                </>
              ) : (
                <>
                  <IconCheck size={13} />
                  确认下单{mode === 'demo' ? '（演示）' : ''}
                </>
              )}
            </Button>
          </div>
        ) : null}

        {result ? (
          <div className="shrink-0 border-t border-hair px-6 py-4">
            <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
              完成
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
