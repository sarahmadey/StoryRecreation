"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** A row that scrolls sideways: whether there's more either way, and a nudge to see it. */
export function useSideScroll<T extends HTMLElement>(remeasureWhen: unknown) {
  const ref = useRef<T>(null);
  const [ends, setEnds] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setEnds({ start: el.scrollLeft < 4, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, remeasureWhen]);
  const slide = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return { ref, ends, measure, slide, overflows: !(ends.start && ends.end) };
}

export function SideArrows({ ends, slide, what }: { ends: { start: boolean; end: boolean }; slide: (dir: 1 | -1) => void; what: string }) {
  return (
    <span className="side-arrows">
      <button type="button" className="shelf-arrow" aria-label={`Earlier ${what}`} onClick={() => slide(-1)} disabled={ends.start}>
        ‹
      </button>
      <button type="button" className="shelf-arrow" aria-label={`More ${what}`} onClick={() => slide(1)} disabled={ends.end}>
        ›
      </button>
    </span>
  );
}

/** A bookshelf: a brass label, books you swipe along (with arrows when there are more), and a plank. */
export function ScrollShelf({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const { ref, ends, measure, slide, overflows } = useSideScroll<HTMLDivElement>(count);
  return (
    <section className="shelf" aria-label={label}>
      <div className="shelf-head">
        <span className="shelf-label">{label}</span>
        {overflows && (
          <span className="shelf-more">
            <span className="small">{count} books</span>
            <SideArrows ends={ends} slide={slide} what="books" />
          </span>
        )}
      </div>
      <div className="shelf-books" ref={ref} onScroll={measure}>
        {children}
      </div>
      <div className="shelf-plank" />
    </section>
  );
}
