// fit.ts — 运行时「装进盒子」：测量内容自然尺寸，超出可用空间就用 CSS zoom 等比缩小（字、框、线一起缩，不会框缩字不缩）。
// zoom 影响布局尺寸（和 transform 不同），缩完父容器按缩后的大小排，不留空白也不溢出。Chromium / Firefox 126+ 支持。
import { useLayoutEffect, type RefObject } from "react";

/**
 * @param ref    要缩放的元素
 * @param mode   "width"：按父元素宽度缩（框图）；"height"：按父元素可用高度缩（整屏内容）
 * @param min    最小缩放，低于这个就不再缩（宁可略溢出也不缩成看不清）
 */
export function useFitZoom(ref: RefObject<HTMLElement | null>, mode: "width" | "height", min = 0.55, deps: unknown[] = [], alt?: { cls: string; below: number }) {
  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const fit = () => {
      (el.style as any).zoom = "1";
      const measure = () => mode === "width" ? el.scrollWidth : el.scrollHeight;
      const avail = mode === "width" ? box.clientWidth : box.clientHeight;
      let need = measure();
      // 备用排法：要缩到 alt.below 以下才放得下，就先换排法（如一排数字改成竖排）再量
      if (alt) {
        el.classList.remove(alt.cls);
        need = measure();
        if (need > 0 && avail > 0 && avail / need < alt.below) { el.classList.add(alt.cls); need = measure(); }
      }
      const z = need > 0 && avail > 0 ? Math.max(min, Math.min(1, avail / need)) : 1;
      (el.style as any).zoom = z < 0.995 ? String(Math.round(z * 1000) / 1000) : "";
      el.dataset.fit = z < 0.995 ? z.toFixed(2) : "";
      // 缩到下限还放不下：标出来，样式据此改对齐（居中溢出会两头都裁，公式的开头最要紧）
      el.dataset.over = need * min > avail + 1 ? "1" : "";
    };
    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(box);
    // 图片、字体晚到会改变内容尺寸
    el.querySelectorAll("img").forEach((img) => { if (!(img as HTMLImageElement).complete) img.addEventListener("load", fit, { once: true }); });
    (document as any).fonts?.ready?.then?.(fit);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
