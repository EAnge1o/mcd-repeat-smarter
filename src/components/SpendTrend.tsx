import { useMemo, useState } from 'react';
import type { SpendPoint } from '../lib/metrics';
import { fmtDateTime, yuan } from '../lib/metrics';
import { EmptyState } from './ui';

/* viewBox 的尺寸刻意贴近实际渲染宽度（约 520–560 CSS px），
   这样 12 号字落到屏幕上就是 11–12px；用 720 宽会让所有文字缩到 8px 以下，读不出来。 */
const W = 560;
const H = 250;
const PAD = { l: 40, r: 12, t: 12, b: 26 };
const PW = W - PAD.l - PAD.r;
const PH = H - PAD.t - PAD.b;

/** y 轴刻度文案。入参是「分」，必须先换算成元，否则 25 元会被写成 ¥2.5k。 */
function axisLabel(cents: number): string {
  const y = cents / 100;
  if (y === 0) return '¥0';
  if (y >= 1000) return `¥${(y / 1000).toFixed(1)}k`;
  return `¥${Number.isInteger(y) ? y : y.toFixed(1)}`;
}

/**
 * 轴刻度：先挑一个「每格」的整数步长，再让上限刚好是步长的 4 倍。
 * 直接把上限取整到 10 的幂会让 28 元的账单画在 50 元的轴上，浪费一半高度。
 */
function axisOf(raw: number): { max: number; step: number } {
  const safe = Number.isFinite(raw) && raw > 0 ? raw : 1000;
  const step = safe <= 2000 ? 100 : safe <= 5000 ? 200 : safe <= 20000 ? 500 : 1000;
  const span = step * 4;
  const max = Math.ceil(safe / span) * span || span;
  return { max, step };
}

/** 单调三次插值，比直接直线连更顺，但不会像普通样条那样在相邻点之间过冲出现假的低谷 */
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

/**
 * 消费趋势。近 N 笔真实实付金额，按时间正序。
 *
 * 金额缺失（接口没返回 paidYuan）的订单不会画成 0 元 —— 那等于伪造了一笔免费订单，
 * 而是在图下方注明排除了几笔。
 */
export function SpendTrend({ points, skipped }: { points: SpendPoint[]; skipped: number }) {
  const [active, setActive] = useState<number | null>(null);

  const model = useMemo(() => {
    const { max } = axisOf(Math.max(...points.map((p) => p.cents), 1) * 1.04);
    const n = points.length;
    const step = n > 1 ? PW / (n - 1) : 0;
    const nodes = points.map((p, i) => ({
      ...p,
      x: PAD.l + (n > 1 ? step * i : PW / 2),
      y: PAD.t + PH - (p.cents / max) * PH,
    }));

    // 网格线的值必须是 max/4，而不是步长本身：max 可能被抬到步长的整数倍以上
    const gridValue = max / 4;
    const ticks = [0, 1, 2, 3, 4].map((i) => ({
      v: gridValue * i,
      y: PAD.t + PH - PH * (i / 4),
    }));

    return { nodes, ticks, max, step };
  }, [points]);

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

  return (
    <div className="relative w-full px-1 pb-1 pt-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`近 ${nodes.length} 笔订单的实付金额趋势`}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#da291c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#da291c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 网格与 y 轴刻度 */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={t.y} x2={W - PAD.r} y2={t.y} stroke="#efedea" strokeWidth="1" />
            <text x={PAD.l - 10} y={t.y + 4} textAnchor="end" fontSize="11.5" fill="#a8a49c" className="tnum">
              {axisLabel(t.v)}
            </text>
          </g>
        ))}

        <path d={area} fill="url(#spendFill)" />
        <path d={line} fill="none" stroke="#da291c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* x 轴标签：点多了只标首尾和中间，避免挤成一团 */}
        {nodes.map((p, i) => {
          const every = Math.ceil(nodes.length / 6);
          const show =
            nodes.length <= 8 ||
            i === 0 ||
            i === nodes.length - 1 ||
            i === Math.floor((nodes.length - 1) / 2) ||
            i % every === 0;
          return show ? (
            <text key={`l-${i}`} x={p.x} y={H - 10} textAnchor="middle" fontSize="11.5" fill="#a8a49c">
              {p.label}
            </text>
          ) : null;
        })}

        {/* 悬停引导线 */}
        {hot ? (
          <line x1={hot.x} y1={PAD.t} x2={hot.x} y2={PAD.t + PH} stroke="#da291c" strokeWidth="1" strokeDasharray="3 3" opacity="0.45" />
        ) : null}

        {nodes.map((p, i) => (
          <circle
            key={`c-${i}`}
            cx={p.x}
            cy={p.y}
            r={active === i ? 4.5 : 3}
            fill="#fff"
            stroke="#da291c"
            strokeWidth="2"
            className="transition-all duration-150"
          />
        ))}

        {/* 命中区：整列可点，比只有小圆点好点中 */}
        {nodes.map((p, i) => {
          const half = model.step > 0 ? model.step / 2 : PW / 2;
          return (
            <rect
              key={`h-${i}`}
              x={p.x - half}
              y={PAD.t}
              width={Math.max(half * 2, 8)}
              height={PH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              tabIndex={0}
              role="button"
              aria-label={`${p.label}，¥${yuan(p.cents)}`}
            />
          );
        })}
      </svg>

      {hot ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-line bg-white px-2.5 py-1.5 shadow-lift"
          style={{ left: `${(hot.x / W) * 100}%`, top: `${(hot.y / H) * 100}%`, marginTop: -52 }}
        >
          <p className="tnum text-[13px] font-semibold text-[#111827]">¥{yuan(hot.cents)}</p>
          <p className="whitespace-nowrap text-[10px] text-[#8a877f]">{fmtDateTime(hot.time)}</p>
        </div>
      ) : null}

      {skipped > 0 || zeroCount > 0 ? (
        <p className="mt-1 px-2 text-[11px] leading-relaxed text-[#a8a49c]">
          {skipped > 0 ? `另有 ${skipped} 笔订单接口未返回金额，未计入趋势线。` : ''}
          {zeroCount > 0 ? `${skipped > 0 ? ' ' : ''}其中 ${zeroCount} 笔为券/积分全额抵扣，实付 ¥0。` : ''}
        </p>
      ) : null}
    </div>
  );
}
