import { useCallback, useEffect, useRef } from 'react';

/**
 * 让一个容器的 CSS 变量跟随指针，用于渲染柔和的暖光。
 *
 * 只做一件事：把坐标写进 --mx / --my，剩下的交给 CSS。
 * 不用 requestAnimationFrame 也会很顺，因为只改两个自定义属性且不触发重排；
 * 但仍然加了 rAF 合并，避免高频 mousemove 造成多余的样式重算。
 */
export function usePointerGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frame = useRef<number | null>(null);

  const onMove = useCallback((e: PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    if (frame.current !== null) return;

    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 尊重"减少动态效果"偏好：完全绑定指针意味着会动，这类装饰直接不挂
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    el.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [onMove]);

  return ref;
}
