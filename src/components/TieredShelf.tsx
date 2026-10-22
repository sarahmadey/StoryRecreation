"use client";

import { useEffect, useState } from "react";
import { BookOnShelf } from "./Books";
import type { Book } from "@/lib/shared/types";

const GAP = 20; // .shelf-books gap
const INSET = 48; // a shelf's padding (16 + 16) and its books' (8 + 8)

/** Every book on one bookcase, filling shelf after shelf (as many to a shelf as fit), in the order given. */
export function TieredShelf({ label, books }: { label: string; books: Book[] }) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [perShelf, setPerShelf] = useState(0);
  useEffect(() => {
    if (!el) return;
    const measure = () => {
      const width = el.querySelector<HTMLElement>(".book")?.offsetWidth ?? 128;
      setPerShelf(Math.max(1, Math.floor((el.clientWidth - INSET + GAP) / (width + GAP))));
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => watch.disconnect();
  }, [el]);

  // Until it's measured (and on the server), one shelf you can swipe along.
  const n = perShelf || books.length || 1;
  const shelves: Book[][] = [];
  for (let i = 0; i < books.length; i += n) shelves.push(books.slice(i, i + n));
  return (
    <div ref={setEl} aria-label={label} role="group">
      {shelves.map((row, i) => (
        <section key={i} className="shelf">
          {i === 0 && (
            <div className="shelf-head">
              <span className="shelf-label">{label}</span>
            </div>
          )}
          <div className="shelf-books">
            {row.map((b) => (
              <BookOnShelf key={b.id} book={b} />
            ))}
          </div>
          <div className="shelf-plank" />
        </section>
      ))}
    </div>
  );
}
