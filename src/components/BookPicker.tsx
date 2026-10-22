"use client";

import Link from "next/link";
import { useState } from "react";
import { Cover } from "./Books";
import type { Book } from "@/lib/shared/types";

/** How many of the most recent books are shown before searching or seeing them all. */
const RECENT = 6;

const pagesOf = (b: Book) => `${b.pageCount} ${b.pageCount === 1 ? "page" : "pages"}`;

/**
 * Choosing one of the family's books, however many there are: the most recent few, a search for the
 * rest, and adding a new one. Once a book is chosen it folds to one line, with "Change".
 */
export function BookPicker({
  books,
  value,
  onChange,
  addHref,
  detail = pagesOf,
}: {
  /** Most recent first. */
  books: Book[];
  value: string;
  onChange: (id: string) => void;
  /** Where "Add a book" goes (and comes back from). */
  addHref: string;
  detail?: (b: Book) => string;
}) {
  const [changing, setChanging] = useState(false);
  const [query, setQuery] = useState("");
  const [all, setAll] = useState(false);
  const chosen = books.find((b) => b.id === value);

  if (chosen && !changing) {
    return (
      <div className="cast-card chosen-book">
        <div className="story-thumb">
          <Cover id={chosen.id} title={chosen.title} kind={chosen.kind} coverUrl={chosen.coverUrl} showTitle={false} />
        </div>
        <div className="story-meta">
          <div className="cast-name">{chosen.title}</div>
          <div className="small muted">{detail(chosen)}</div>
        </div>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setChanging(true)}>
          Change
        </button>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = q ? books.filter((b) => b.title.toLowerCase().includes(q)) : all ? books : books.slice(0, RECENT);
  const choose = (id: string) => {
    onChange(id);
    setChanging(false);
    setQuery("");
  };
  return (
    <div className="stack" style={{ ["--gap" as string]: "10px" }}>
      {books.length > RECENT && (
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`🔍 Find one of your ${books.length} books`}
          aria-label="Find a book"
        />
      )}
      <div className="choices" style={{ ["--min" as string]: "120px" }}>
        {shown.map((b) => (
          <button key={b.id} type="button" className="choice" aria-pressed={b.id === value} onClick={() => choose(b.id)} style={{ padding: 10 }}>
            <div className="story-thumb" style={{ width: 66, height: 88 }}>
              <Cover id={b.id} title={b.title} kind={b.kind} coverUrl={b.coverUrl} showTitle={false} />
            </div>
            <span className="choice-title" style={{ fontSize: "1rem" }}>
              {b.title}
            </span>
            <span className="choice-sub">{detail(b)}</span>
          </button>
        ))}
        {!q && (
          <Link className="choice" href={addHref}>
            <span className="choice-emoji">＋</span>
            <span className="choice-title">Add a book</span>
            <span className="choice-sub">Photograph its pages</span>
          </Link>
        )}
      </div>
      {q && shown.length === 0 && (
        <p className="small muted" style={{ margin: 0 }}>
          No book by that name. <Link href={addHref}>Add it?</Link>
        </p>
      )}
      {!q && !all && books.length > RECENT && (
        <div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAll(true)}>
            See all {books.length} books
          </button>
        </div>
      )}
      {chosen && (
        <div>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setChanging(false)}>
            Keep {chosen.title}
          </button>
        </div>
      )}
    </div>
  );
}
