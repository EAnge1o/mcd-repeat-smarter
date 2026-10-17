import { useEffect, useMemo, useRef, useState } from 'react';
import type { SpendPoint } from '../lib/metrics';
import { fmtDateTime, yuan } from '../lib/metrics';
import { EmptyState, cx } from './ui';

const PAD = { l: 46, r: 8, t: 16, b: 22 };

/** y 轴刻度文案。入参是「分」，必须先换算成元，否则 25 元会被写成 ¥2.5k。 */
function axisLabel(cents: number): string {
  const y = cents / 100;
  if (y === 0) return '¥0';
  if (y >= 1000) return `¥${(y / 1000).toFixed(1)}k`;
  return `¥${Number.isInteger(y) ? y : y.toFixed(1)}`;
}

/**
 * 轴刻度：先挑一个「每格」的整数步长，再让上限刚好是步长的整数倍。
 * 直接把上限取整到 10 的幂会让 28 元的账单画在 50 元的轴上，浪费一半高度。
 */
function axisOf(raw: number): { max: number; step: number } {
  const safe = Number.isFinite(raw) && raw > 0 ? raw : 1000;
  const step = safe <= 2000 ? 100 : safe <= 5000 ? 200 : safe <= 20000 ? 500 : 1000;
  const span = step * 2;
  const max = Math.ceil(safe / span) * span || span;
  return { max, step };
}

/** 单调三次插值，比直线连更顺，但不会像普通样条那样在相邻点之间过冲出现假的低谷 */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M${pts[0].x} ${pts[0].y}`;

  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.16;
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

interface SpendTrendProps {
  points: SpendPoint[];
  skipped: number;
  /** 高亮的订单（从右栏或列表点进来的那一单） */
  selectedId?: string | null;
  /** 点击某个点：用于联动下面的订单列表 */
  onPick?: (p: SpendPoint) => void;
  height?: number;
}

/**
 * 消费趋势条带。
 *
 * 用 ResizeObserver 量出真实像素宽度再定 viewBox，而不是写死一个 560：
 * 写死的 viewBox 会在窄容器里把 11px 字缩成 8px，在宽容器里又会把字放大一倍。
 * 量出来之后 1 SVG 单位 = 1 CSS 像素，字号在任何断点都是字面值。
 *
 * 金额缺失（接口没返回 paidYuan）的订单不会画成 0 元 —— 那等于伪造了一笔免费订单，
 * 而是在图下方注明排除了几笔。
 */
export function SpendTrend({ points, skipped, selectedId, onPick, height = 168 }: SpendTrendProps) {
  const [active, setActive] = useState<number | null>(null);
  const [w, setW] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    // 只靠 ResizeObserver 不够稳：首次回调可能拿到尚未完成布局的 0 宽，
    // 而元素本身之后不会再变尺寸，于是永远停在兜底值上（图表被压成一小段）。
    // 所以挂载时先量一次，再补一帧复量，并把 window resize 也接上。
    const measure = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setW(next);
    };

    measure();
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const H = height;
  const PW = Math.max(w - PAD.l - PAD.r, 40);
  const PH = H - PAD.t - PAD.b;

  const model = useMemo(() => {
    const { max } = axisOf(Math.max(...points.map((p) => p.cents), 1) * 1.04);
    const n = points.length;
    const step = n > 1 ? PW / (n - 1) : 0;
    const nodes = points.map((p, i) => ({
      ...p,
      x: PAD.l + (n > 1 ? step * i : PW / 2),
      y: PAD.t + PH - (p.cents / max) * PH,
    }));
    // 只画 0 / 中值 / 上限三条：条带图不需要四等分的密集网格
    const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, y: PAD.t + PH - PH * f }));
    return { nodes, ticks, max, step };
  }, [points, PW, PH]);

  if (points.length === 0) {
    return (
      <EmptyState
        compact
        title="还没有可画的消费数据"
        desc="历史订单里没有返回金额。换到真实 MCP 模式，或者先完成一单，这里就会有趋势。"
      />
    );
  }

  const { nodes, ticks } = model;
  const zeroCount = points.filter((p) => p.cents === 0).length;
  const line = smoothPath(nodes);
  const area = `${line} L${nodes[nodes.length - 1].x} ${PAD.t + PH} L${nodes[0].x} ${PAD.t + PH} Z`;
  const hot = active !== null ? nodes[active] : null;
  // 按可用宽度决定标几个 x 轴标签，避免小屏挤成一团
  const maxLabels = Math.max(2, Math.floor(PW / 62));

  return (
    <div ref={boxRef} className="w-full">
      {w > 0 ? (
        <>
          <div className="relative">
            <svg
              width={w}
              height={H}
              viewBox={`0 0 ${w} ${H}`}
              role="img"
              aria-label={`近 ${nodes.length} 笔订单的实付金额趋势`}
              className="block"
            >
              <defs>
                <linearGradient id="spendBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#da291c" stopOpacity="0.13" />
                  <stop offset="100%" stopColor="#da291c" stopOpacity="0" />
                </linearGradient>
              </defs>

              {ticks.map((t, i) => (
                <g key={i}>
                  <line
                    x1={PAD.l}
                    y1={t.y}
                    x2={w - PAD.r}
                    y2={t.y}
                    stroke={i === 0 ? '#ddd9d2' : '#efedea'}
                    strokeWidth="1"
                  />
                  <text x={PAD.l - 10} y={t.y + 4} textAnchor="end" fontSize="10.5" fill="#6f6a62" className="tnum">
                    {axisLabel(t.v)}
                  </text>
                </g>
              ))}

              <path d={area} fill="url(#spendBand)" />
              <path d={line} fill="none" stroke="#da291c" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />

              {nodes.map((p, i) => {
                const show = nodes.length <= maxLabels || i === 0 || i === nodes.length - 1 || i === Math.floor((nodes.length - 1) / 2);
                if (!show) return null;
                // 首尾标签贴边，否则居中的文字会被 SVG 边界裁掉半个
                const first = i === 0;
                const last = i === nodes.length - 1;
                return (
                  <text
                    key={`l-${i}`}
                    x={first ? PAD.l : last ? w - PAD.r : p.x}
                    y={H - 6}
                    textAnchor={first ? 'start' : last ? 'end' : 'middle'}
                    fontSize="10.5"
                    fill="#6f6a62"
                    className="tnum"
                  >
                    {p.label}
                  </text>
                );
              })}

              {hot ? (
                <line x1={hot.x} y1={PAD.t} x2={hot.x} y2={PAD.t + PH} stroke="#da291c" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
              ) : null}

              {nodes.map((p, i) => {
                const on = active === i || selectedId === p.orderId;
                return (
                  <circle
                    key={`c-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={on ? 4 : 2.5}
                    fill="#fff"
                    stroke="#da291c"
                    strokeWidth={on ? 2.5 : 1.75}
                    className="transition-all duration-150"
                  />
                );
              })}

              {/* 命中区整列可点，比只有小圆点好点中。左右各让 4px 但夹在绘图区内，避免热区跑到画布外面 */}
              {nodes.map((p, i) => {
                const half = model.step > 0 ? model.step / 2 : PW / 2;
                const x0 = Math.max(PAD.l - 4, p.x - half);
                const x1 = Math.min(w - PAD.r + 4, p.x + half);
                return (
                  <rect
                    key={`h-${i}`}
                    x={x0}
                    y={PAD.t}
                    width={Math.max(x1 - x0, 10)}
                    height={PH + 6}
                    fill="transparent"
                    className={cx(onPick ? 'cursor-pointer' : 'cursor-default')}
                    onMouseEnter={() => setActive(i)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => onPick?.(p)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPick?.(p);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${p.label}，¥${yuan(p.cents)}${onPick ? '，查看这一单' : ''}`}
                  />
                );
              })}
            </svg>

            {hot ? (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 shadow-lift"
                style={{ left: `${(hot.x / w) * 100}%`, top: `${(hot.y / H) * 100}%`, marginTop: -50 }}
              >
                <p className="tnum text-[12.5px] font-semibold leading-tight text-[#111827]">¥{yuan(hot.cents)}</p>
                <p className="whitespace-nowrap text-[10px] text-[#6f6a62]">{fmtDateTime(hot.time)}</p>
              </div>
            ) : null}
          </div>

          {skipped > 0 || zeroCount > 0 ? (
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-[#6f6a62]">
              {skipped > 0 ? `另有 ${skipped} 笔订单接口未返回金额，未计入趋势线。` : ''}
              {zeroCount > 0 ? `${skipped > 0 ? ' ' : ''}其中 ${zeroCount} 笔为券/积分全额抵扣，实付 ¥0。` : ''}
            </p>
          ) : null}
        </>
      ) : (
        <div style={{ height: H }} aria-hidden="true" />
      )}
    </div>
  );
}
