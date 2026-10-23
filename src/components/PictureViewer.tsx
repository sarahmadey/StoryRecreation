"use client";

import { useEffect, useRef, useState } from "react";

// A picture, full size: tap one to see its details. Swipe (or use the arrows)
// to go through the others, and act on one from here, like choosing a sketch.

export interface ViewerItem {
  src: string;
  caption: string;
  /** e.g. choosing a sketch: done shows it's the chosen one. */
  action?: { label: string; done: boolean; onClick: () => void };
}

export function PictureViewer({ items, start, onClose }: { items: ViewerItem[]; start: number; onClose: () => void }) {
  const [index, setIndex] = useState(Math.min(Math.max(0, start), items.length - 1));
  const touch = useRef<number | null>(null);
  const item = items[index];
  const go = (step: number) => setIndex((i) => (i + step + items.length) % items.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    // The page underneath stays put while the picture is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!item) return null;
  return (
    <div
      className="viewer"
      role="dialog"
      aria-modal="true"
      aria-label={item.caption}
      onClick={onClose}
      onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touch.current === null || items.length < 2) return;
        const dx = e.changedTouches[0].clientX - touch.current;
        touch.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <button type="button" className="viewer-close icon-btn" aria-label="Close" onClick={onClose}>
        ✕
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={item.src} src={item.src} alt={item.caption} />
        <figcaption>{item.caption}</figcaption>
        {item.action && (
          <button type="button" className={`btn ${item.action.done ? "btn-ghost" : ""}`} onClick={item.action.onClick} disabled={item.action.done}>
            {item.action.done ? "✓ " : ""}
            {item.action.label}
          </button>
        )}
      </figure>
      {items.length > 1 && (
        <>
          <button
            type="button"
            className="viewer-step viewer-prev icon-btn"
            aria-label="Previous picture"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            ‹
          </button>
          <button
            type="button"
            className="viewer-step viewer-next icon-btn"
            aria-label="Next picture"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            ›
          </button>
        </>
      )}
    </div>
  );
}
