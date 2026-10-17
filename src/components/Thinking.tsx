import { useEffect, useState } from 'react';

/**
 * 思考状态。
 *
 * 诚实原则：`/api/adjust` 是一次 HTTP 请求，服务端内部完成了意图解析、
 * 在售校验与官方核价 —— 前端**无法**知道当前进行到哪一步。
 * 所以这里不伪造分步打勾，只展示：
 *   1. 这次请求实际会做的事（一次性说明）
 *   2. 真实经过的秒数（读本地时钟）
 *   3. 一条不确定进度条（表示「还在跑」，不表示百分比）
 */
export function Thinking({ title = '正在解析你的说法，并查询门店真实菜单…', hint }: { title?: string; hint?: string }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="thinking" role="status" aria-live="polite">
      <span className="thinking__dot" aria-hidden="true" />
      <div className="thinking__body">
        <div className="thinking__title">{title}</div>
        <div className="thinking__desc">
          {hint ?? '这一步会同时完成：解析你的说法 → 校验商品是否还在售 → 用官方接口核价。'}
        </div>
        <div className="thinking__meter">
          <span>{seconds}s</span>
          <span className="thinking__bar" aria-hidden="true" />
          <span>通常 3–8s</span>
        </div>
      </div>
    </div>
  );
}
