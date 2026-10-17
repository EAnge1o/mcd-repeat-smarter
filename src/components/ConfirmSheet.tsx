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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose} role="presentation">
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="订单确认"
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-t-2xl bg-white shadow-lift sm:rounded-2xl"
      >
        {/* 头 */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-4 py-3 md:px-5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600" aria-hidden="true">
            <IconReceipt size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold tracking-tight text-[#111827]">确认这一单</h2>
            <p className="text-[11px] text-[#8a877f]">提交前请核对门店、餐品与金额</p>
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

        {/* 主体 */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : null}

          {error ? (
            <Alert kind="error" title="出了点问题" hint={error.hint}>
              {error.message}
            </Alert>
          ) : null}

          {result ? (
            <div className="rounded-lg border border-[#cfe9da] bg-[#f2fbf6] p-3.5">
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#134a2e]">
                <IconCheck size={15} />
                {result.mode === 'demo' ? '演示下单完成' : '订单已提交'}
              </p>
              {result.orderId ? (
                <p className="mt-1 break-all font-mono text-[11px] text-[#1c5c3b]">订单号 {result.orderId}</p>
              ) : null}
              <p className="mt-1 text-xs leading-relaxed text-[#1c5c3b]">{result.note}</p>
              {result.payUrl ? (
                <a
                  href={result.payUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex h-8 items-center rounded-lg bg-brand-500 px-3 text-xs font-medium text-white transition-colors duration-150 hover:bg-brand-600"
                >
                  去支付
                </a>
              ) : null}
            </div>
          ) : null}

          {preview && !result ? (
            <>
              {/* 门店与来源：用户必须能确认「下到哪家店」 */}
              <div className="flex items-center gap-2.5 rounded-lg border border-line bg-[#faf9f7] px-3 py-2.5">
                <IconStore size={15} className="shrink-0 text-[#8a877f]" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-[#111827]">{storeName || `门店 ${storeCode}`}</p>
                  <p className="truncate text-[11px] text-[#8a877f]">
                    {BE_TYPE_LABEL[beType]} · {mode === 'demo' ? '演示数据，不会产生真实订单' : '麦当劳 MCP 实时'}
                  </p>
                </div>
              </div>

              {/* 餐品 */}
              <div className="rounded-lg border border-line">
                <ul className="divide-y divide-line">
                  {items.map((item, i) => {
                    // 金额按商品编码从官方核价结果里取；取不到就不显示金额，绝不猜
                    const line = preview.price.lines.find((l) => l.productCode === item.productCode);
                    return (
                      <li key={`${item.productCode}-${i}`} className="flex items-baseline gap-2 px-3 py-2">
                        <span className="tnum shrink-0 text-[11px] text-[#8a877f]">{item.quantity}×</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-[#111827]">{item.name}</span>
                          {item.children.length > 0 ? (
                            <span className="mt-0.5 block truncate text-[10px] text-[#a8a49c]">
                              {item.children.map((c) => `${c.roundName ? `${c.roundName}·` : ''}${c.name}`).join(' / ')}
                            </span>
                          ) : null}
                        </span>
                        <span className="tnum shrink-0 text-[12px] text-[#4b4945]">{line ? `¥${yuan(line.subtotalCents)}` : ''}</span>
                      </li>
                    );
                  })}
                </ul>

                {/* 只有真的存在优惠时才展开原价/优惠明细；
                    否则它会和底部的「应付」变成两个一样的数字 */}
                {preview.price.discountCents > 0 ? (
                  <div className="space-y-1 border-t border-line bg-[#faf9f7] px-3 py-2 text-[12px]">
                    <div className="flex justify-between text-[#6b6862]">
                      <span>商品原价</span>
                      <span className="tnum">¥{yuan(preview.price.originalPriceCents)}</span>
                    </div>
                    <div className="flex justify-between text-[#1d7a45]">
                      <span>优惠</span>
                      <span className="tnum">−¥{yuan(preview.price.discountCents)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {changeNotes.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-[#6b6862]">这次改的</p>
                  <ul className="space-y-1">
                    {changeNotes.map((n, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#4b4945]">
                        <IconCheck size={11} className="mt-0.5 shrink-0 text-[#1d7a45]" />
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <p className="mb-1.5 text-[11px] font-medium text-[#6b6862]">取餐方式</p>
                <div className="grid grid-cols-2 gap-2">
                  {preview.takeWayList.map((t) => (
                    <button
                      key={t.code}
                      type="button"
                      onClick={() => setTakeWay(t.code)}
                      aria-pressed={takeWay === t.code}
                      className={cx(
                        'rounded-lg border px-2.5 py-2 text-left transition-all duration-150 ease-out',
                        takeWay === t.code
                          ? 'border-brand-500 bg-brand-50/50 shadow-[inset_0_0_0_1px_#da291c]'
                          : 'border-line hover:border-[#d8d4cd] hover:bg-[#faf9f7]',
                      )}
                    >
                      <span className="block truncate text-[12px] font-medium text-[#111827]">{t.title}</span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#8a877f]">{t.subtitle}</span>
                    </button>
                  ))}
                </div>
              </div>

              {preview.priceChecks.length > 0 ? (
                <ul className="space-y-1">
                  {preview.priceChecks.map((n, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-[#8a5a00]">
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
          <div className="shrink-0 border-t border-line bg-white px-4 py-3 md:px-5">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[#6b6862]">
                应付
                {mode === 'demo' ? <Badge tone="warn" className="ml-1.5">演示</Badge> : null}
              </span>
              <span className="tnum text-[22px] font-semibold leading-none tracking-tight text-[#111827]">
                <span className="mr-0.5 text-[13px] font-normal text-[#8a877f]">¥</span>
                {yuan(preview.price.priceCents)}
              </span>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-[#a8a49c]">
              金额为官方接口实时核价，提交时可能因门店库存或活动变化产生微小差异，实际以门店出餐为准。
              {mode === 'demo' ? ' 当前为演示数据，不会产生真实订单。' : ''}
            </p>

            <label className="mt-2.5 flex cursor-pointer items-start gap-2 rounded-lg bg-[#faf9f7] px-2.5 py-2">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-500"
              />
              <span className="text-[11.5px] leading-relaxed text-[#4b4945]">
                我已核对门店、餐品与金额，确认提交这一单。
                <span className="text-[#a8a49c]">（系统不会在你确认前下单）</span>
              </span>
            </label>

            <Button variant="primary" size="lg" className="mt-2.5 w-full" disabled={!checked || submitting} onClick={() => void submit()}>
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin-slow rounded-full border-2 border-white/35 border-t-white" />
                  提交中…
                </>
              ) : (
                <>
                  <IconCheck size={14} />
                  确认下单{mode === 'demo' ? '（演示）' : ''}
                </>
              )}
            </Button>
          </div>
        ) : null}

        {result ? (
          <div className="shrink-0 border-t border-line px-4 py-3 md:px-5">
            <Button variant="secondary" size="lg" className="w-full" onClick={onClose}>
              完成
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
