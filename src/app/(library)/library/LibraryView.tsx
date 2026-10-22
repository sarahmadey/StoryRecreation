"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shelf, StoryCardView } from "@/components/Books";
import { TieredShelf } from "@/components/TieredShelf";
import { SHELF_ORDER } from "@/lib/shared/options";
import type { Book, Profile, StoryCard } from "@/lib/shared/types";

type Filter = "all" | "favorites" | "read" | `p:${string}`;
/** Books on the bookcase, or every story in a list. */
type View = "books" | "stories";
/** Books on shelves by kind, or all together: the newest first, or A to Z. */
type Order = "kind" | "newest" | "az";

const ORDERS: { id: Order; label: string; books: boolean }[] = [
  { id: "kind", label: "By kind", books: true },
  { id: "newest", label: "Newest first", books: false },
  { id: "az", label: "A to Z", books: false },
];
const SAVED = "storyhollow:library";
const byTitle = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

export function LibraryView({
  books,
  stories,
  profiles,
  currentProfileId,
}: {
  books: Book[];
  stories: StoryCard[];
  profiles: Profile[];
  currentProfileId: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("books");
  const [order, setOrder] = useState<Order>("kind");
  const [storyOrder, setStoryOrder] = useState<Exclude<Order, "kind">>("newest");

  // The way this family likes the library laid out, kept on this phone.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED) ?? "{}") as { view?: View; order?: Order; storyOrder?: Order };
      if (saved.view === "books" || saved.view === "stories") setView(saved.view);
      if (ORDERS.some((o) => o.id === saved.order)) setOrder(saved.order!);
      if (saved.storyOrder === "newest" || saved.storyOrder === "az") setStoryOrder(saved.storyOrder);
    } catch {
      // ignore
    }
  }, []);
  const remember = (next: { view?: View; order?: Order; storyOrder?: Order }) => {
    try {
      localStorage.setItem(SAVED, JSON.stringify({ view, order, storyOrder, ...next }));
    } catch {
      // ignore
    }
  };

  const { shelves, shownBooks, shownStories } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const storyMatches = (s: StoryCard) =>
      (filter === "all" ||
        (filter === "favorites" && s.favorite) ||
        (filter === "read" && s.mode === "read") ||
        (filter.startsWith("p:") && s.profileId === filter.slice(2))) &&
      (!q || s.title.toLowerCase().includes(q) || s.bookTitle.toLowerCase().includes(q));
    const shownStories = stories.filter(storyMatches);
    const bookIds = new Set(shownStories.map((s) => s.bookId));
    // A book is as new as its newest story.
    const latest = new Map<string, number>();
    for (const s of stories) latest.set(s.bookId, Math.max(latest.get(s.bookId) ?? 0, s.createdAt));
    const newest = (b: Book) => Math.max(b.createdAt, latest.get(b.id) ?? 0);
    const shownBooks = books
      .filter((b) => bookIds.has(b.id) || (filter === "all" && (!q || b.title.toLowerCase().includes(q))))
      .sort((a, b) => (order === "az" ? byTitle(a.title, b.title) : newest(b) - newest(a)));
    const byShelf = new Map<string, Book[]>();
    for (const b of shownBooks) byShelf.set(b.shelf, [...(byShelf.get(b.shelf) ?? []), b]);
    const rank = (name: string) => {
      const i = SHELF_ORDER.indexOf(name);
      return i === -1 ? 100 : i;
    };
    const shelves = [...byShelf.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
    if (storyOrder === "az") shownStories.sort((a, b) => byTitle(a.title, b.title));
    return { shelves, shownBooks, shownStories };
  }, [books, stories, filter, query, order, storyOrder]);

  const emojiOf = new Map(profiles.map((p) => [p.id, p.avatar]));
  const nothing = (
    <div className="bookcase">
      <Shelf
        label={books.length ? "Nothing matches" : "Your first shelf"}
        books={[]}
        empty={
          books.length ? (
            "Nothing matches. Try another filter."
          ) : (
            <>
              The shelves are empty, for now. <Link href="/create">Photograph a book</Link> to begin.
            </>
          )
        }
      />
    </div>
  );

  return (
    <>
      <div className="spread" style={{ marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Every book, every story</div>
          <h1 style={{ margin: 0 }}>The Library</h1>
        </div>
        <Link href="/create" className="btn">
          ＋ Add a book
        </Link>
      </div>

      <div className="library-views" role="tablist" aria-label="Show">
        {(
          [
            ["books", "📚 Books", shownBooks.length],
            ["stories", "🎧 Stories", shownStories.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            className="dark-chip"
            aria-pressed={view === id}
            onClick={() => {
              setView(id);
              remember({ view: id });
            }}
          >
            {label} <span className="chip-count">{count}</span>
          </button>
        ))}
      </div>

      <div className="spread" style={{ marginBottom: 14 }}>
        <div className="chips" role="group" aria-label="Whose">
          <button className="dark-chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
            Everyone
          </button>
          {profiles.map((p) => (
            <button key={p.id} className="dark-chip" aria-pressed={filter === `p:${p.id}`} onClick={() => setFilter(`p:${p.id}`)}>
              {p.avatar} {p.id === currentProfileId ? `${p.name} (me)` : p.name}
            </button>
          ))}
          <button className="dark-chip" aria-pressed={filter === "favorites"} onClick={() => setFilter("favorites")}>
            ⭐ Favorites
          </button>
          <button className="dark-chip" aria-pressed={filter === "read"} onClick={() => setFilter("read")}>
            📖 Read-alouds
          </button>
        </div>
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Find a book or story"
          style={{ maxWidth: 280 }}
          aria-label="Search the library"
        />
      </div>

      <div className="library-order" role="group" aria-label={view === "books" ? "Arrange the books" : "Sort the stories"}>
        <span className="find-label">{view === "books" ? "Arrange" : "Sort"}</span>
        {ORDERS.filter((o) => view === "books" || !o.books).map((o) => {
          const on = view === "books" ? order === o.id : storyOrder === o.id;
          return (
            <button
              key={o.id}
              type="button"
              className="dark-chip"
              aria-pressed={on}
              onClick={() => {
                if (view === "books") {
                  setOrder(o.id);
                  remember({ order: o.id });
                } else if (o.id !== "kind") {
                  setStoryOrder(o.id);
                  remember({ storyOrder: o.id });
                }
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {view === "books" &&
        (shownBooks.length === 0 ? (
          nothing
        ) : order === "kind" ? (
          <div className="bookcase">
            {shelves.map(([name, list]) => (
              <Shelf key={name} label={name} books={list} />
            ))}
          </div>
        ) : (
          <div className="bookcase">
            <TieredShelf label={order === "az" ? "A to Z" : "Newest first"} books={shownBooks} />
          </div>
        ))}

      {view === "stories" &&
        (shownStories.length === 0 ? (
          <p className="muted center">{stories.length ? "No stories match. Try another filter." : "No stories yet."}</p>
        ) : (
          <div className="story-list">
            {shownStories.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        ))}
    </>
  );
}
