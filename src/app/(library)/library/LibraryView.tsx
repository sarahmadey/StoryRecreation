"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shelf, StoryCardView } from "@/components/Books";
import { SHELF_ORDER } from "@/lib/shared/options";
import type { Book, Profile, StoryCard } from "@/lib/shared/types";

type Filter = "all" | "favorites" | "read" | `p:${string}`;

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

  const { shelves, shownStories } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const storyMatches = (s: StoryCard) =>
      (filter === "all" ||
        (filter === "favorites" && s.favorite) ||
        (filter === "read" && s.mode === "read") ||
        (filter.startsWith("p:") && s.profileId === filter.slice(2))) &&
      (!q || s.title.toLowerCase().includes(q) || s.bookTitle.toLowerCase().includes(q));
    const shownStories = stories.filter(storyMatches);
    const bookIds = new Set(shownStories.map((s) => s.bookId));
    const shownBooks = books.filter(
      (b) => bookIds.has(b.id) || (filter === "all" && (!q || b.title.toLowerCase().includes(q))),
    );
    const byShelf = new Map<string, Book[]>();
    for (const b of shownBooks) byShelf.set(b.shelf, [...(byShelf.get(b.shelf) ?? []), b]);
    const order = (name: string) => {
      const i = SHELF_ORDER.indexOf(name);
      return i === -1 ? 100 : i;
    };
    const shelves = [...byShelf.entries()].sort((a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]));
    return { shelves, shownStories };
  }, [books, stories, filter, query]);

  const emojiOf = new Map(profiles.map((p) => [p.id, p.avatar]));

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

      <div className="spread" style={{ marginBottom: 20 }}>
        <div className="chips" role="group" aria-label="Show">
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
            🎧 Read-alouds
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

      {shelves.length ? (
        <div className="bookcase">
          {shelves.map(([name, list]) => (
            <Shelf key={name} label={name} books={list} />
          ))}
        </div>
      ) : (
        <div className="bookcase">
          <Shelf
            label={books.length ? "Nothing matches" : "Your first shelf"}
            books={[]}
            empty={
              books.length ? (
                "No books match. Try another filter."
              ) : (
                <>
                  The shelves are empty, for now. <Link href="/create">Photograph a book</Link> to begin.
                </>
              )
            }
          />
        </div>
      )}

      {shownStories.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>All stories</h2>
            <span className="faint small">{shownStories.length} in all</span>
          </div>
          <div className="story-list">
            {shownStories.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
