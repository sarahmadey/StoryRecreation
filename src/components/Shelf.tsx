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
