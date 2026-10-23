"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { StoryCardView } from "@/components/Books";
import { Bookcase, EmptyBookcase, type ShelfFolder } from "@/components/Bookcase";
import { SHELF_ORDER } from "@/lib/shared/options";
import type { Book, Profile, StoryCard } from "@/lib/shared/types";
import { FolderMaker } from "./FolderMaker";

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
const rank = (shelf: string) => {
  const i = SHELF_ORDER.indexOf(shelf);
  return i === -1 ? 100 : i;
};
/** The shelf a folder stands on: the one most of its books are on (the first of them, if it's a tie). */
function shelfFor(books: Book[]): string {
  const count = new Map<string, number>();
  for (const b of books) count.set(b.shelf, (count.get(b.shelf) ?? 0) + 1);
  return [...count].sort((a, b) => b[1] - a[1] || rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))[0][0];
}

export function LibraryView({
  books: booksNow,
  stories,
  profiles,
  currentProfileId,
  showReadAlouds = false,
}: {
  books: Book[];
  stories: StoryCard[];
  profiles: Profile[];
  currentProfileId: string | null;
  /** Open on the list of read-alouds (from Read to Me). */
  showReadAlouds?: boolean;
}) {
  // The books as the server last said: as the page loaded, or as a folder was saved.
  const [books, setBooks] = useState(booksNow);
  useEffect(() => setBooks(booksNow), [booksNow]);
  const [filter, setFilter] = useState<Filter>(showReadAlouds ? "read" : "all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>(showReadAlouds ? "stories" : "books");
  const [order, setOrder] = useState<Order>("kind");
  const [storyOrder, setStoryOrder] = useState<Exclude<Order, "kind">>("newest");
  // The folder that's open (it's in the address, so going back closes it), and the panel for making or changing one.
  const params = useSearchParams();
  const asked = params.get("folder");
  const folder = asked && books.some((b) => b.folder === asked) ? asked : null;
  const [making, setMaking] = useState<"new" | "this" | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const goToFolder = (name: string | null, how: "push" | "replace" = "push") => {
    const next = new URLSearchParams(params.toString());
    if (name) next.set("folder", name);
    else next.delete("folder");
    const qs = next.toString();
    const url = qs ? `?${qs}` : window.location.pathname;
    if (how === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
    setMaking(null);
    window.scrollTo({ top: 0 });
  };
  // Going back (or to another folder) puts away a half-made change.
  useEffect(() => setMaking(null), [folder]);
  // A folder that was just made or changed glows on its shelf for a moment, scrolled to where it went.
  useEffect(() => {
    if (!fresh) return;
    const el = document.querySelector(".folder.fresh");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setFresh(null), 4000);
    return () => clearTimeout(t);
  }, [fresh, books]);

  // The way this family likes the library laid out, kept on this phone.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED) ?? "{}") as { view?: View; order?: Order; storyOrder?: Order };
      if (!showReadAlouds && (saved.view === "books" || saved.view === "stories")) setView(saved.view);
      if (ORDERS.some((o) => o.id === saved.order)) setOrder(saved.order!);
      if (saved.storyOrder === "newest" || saved.storyOrder === "az") setStoryOrder(saved.storyOrder);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const remember = (next: { view?: View; order?: Order; storyOrder?: Order }) => {
    try {
      localStorage.setItem(SAVED, JSON.stringify({ view, order, storyOrder, ...next }));
    } catch {
      // ignore
    }
  };

  const { shelves, shownBooks, shownStories, folders, loose } = useMemo(() => {
    // An open folder shows every book in it (and their stories): the choices and the search are for the shelves outside.
    const q = folder ? "" : query.trim().toLowerCase();
    const only = folder ? "all" : filter;
    const folderOf = new Map(books.map((b) => [b.id, b.folder]));
    const storyMatches = (s: StoryCard) =>
      (!folder || folderOf.get(s.bookId) === folder) &&
      (only === "all" ||
        (only === "favorites" && s.favorite) ||
        (only === "read" && s.mode === "read") ||
        (only.startsWith("p:") && s.profileId === only.slice(2))) &&
      (!q || s.title.toLowerCase().includes(q) || s.bookTitle.toLowerCase().includes(q));
    const shownStories = stories.filter(storyMatches);
    const bookIds = new Set(shownStories.map((s) => s.bookId));
    // A book is as new as its newest story.
    const latest = new Map<string, number>();
    for (const s of stories) latest.set(s.bookId, Math.max(latest.get(s.bookId) ?? 0, s.createdAt));
    const newest = (b: Book) => Math.max(b.createdAt, latest.get(b.id) ?? 0);
    const shownBooks = books
      .filter((b) => (!folder || b.folder === folder) && (bookIds.has(b.id) || (only === "all" && (!q || b.title.toLowerCase().includes(q)))))
      .sort((a, b) => (order === "az" ? byTitle(a.title, b.title) : newest(b) - newest(a)));
    // On the shelves, a folder's books stand together in it, the folder as new as its newest book. A search finds
    // every book that matches, in a folder or not.
    const inFolders = new Map<string, Book[]>();
    if (!folder && !q) for (const b of shownBooks) if (b.folder) inFolders.set(b.folder, [...(inFolders.get(b.folder) ?? []), b]);
    const folders: ShelfFolder[] = [...inFolders].map(([name, list]) => ({ name, books: list }));
    if (order === "az") folders.sort((a, b) => byTitle(a.name, b.name));
    const loose = shownBooks.filter((b) => !b.folder || !inFolders.has(b.folder));
    const byShelf = new Map<string, { folders: ShelfFolder[]; books: Book[] }>();
    const on = (shelf: string) => byShelf.get(shelf) ?? byShelf.set(shelf, { folders: [], books: [] }).get(shelf)!;
    for (const f of folders) on(shelfFor(f.books)).folders.push(f);
    for (const b of loose) on(b.shelf).books.push(b);
    const shelves = [...byShelf.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
    if (storyOrder === "az") shownStories.sort((a, b) => byTitle(a.title, b.title));
    return { shelves, shownBooks, shownStories, folders, loose };
  }, [books, stories, filter, query, order, storyOrder, folder]);

  const emojiOf = new Map(profiles.map((p) => [p.id, p.avatar]));
  const nothing = (
    <EmptyBookcase label={books.length ? "Nothing matches" : "Your first shelf"}>
      {books.length ? (
        "Try another filter, or clear the search."
      ) : (
        <>
          The shelves are empty, for now. <Link href="/create">Photograph a book</Link> to begin.
        </>
      )}
    </EmptyBookcase>
  );

  // Making a folder (or changing the open one): right where it was asked for.
  const maker = making && (
    <FolderMaker
      key={making === "this" ? `this:${folder}` : "new"}
      books={books}
      folder={making === "this" ? folder : null}
      onCancel={() => setMaking(null)}
      onDone={(name, saved) => {
        setBooks(saved);
        setMaking(null);
        if (folder && name !== folder) goToFolder(name, "replace");
        setFresh(folder ? null : name);
      }}
    />
  );

  return (
    <>
      {folder ? (
        <>
          <button type="button" className="back-link" onClick={() => goToFolder(null)}>
            ‹ Back to the library
          </button>
          <div className="spread" style={{ marginBottom: 18 }}>
            <div>
              <div className="eyebrow">📁 A folder of {books.filter((b) => b.folder === folder).length} books</div>
              <h1 style={{ margin: 0 }}>{folder}</h1>
            </div>
            {making !== "this" && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaking("this")}>
                ✏️ Change this folder
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="spread" style={{ marginBottom: 18 }}>
          <div>
            <div className="eyebrow">Every book, every story</div>
            <h1 style={{ margin: 0 }}>The Library</h1>
          </div>
          <Link href="/books/new" className="btn">
            ＋ Add a book
          </Link>
        </div>
      )}

      {/* Changing an open folder: just under its name. */}
      {folder && maker}

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

      {/* Whose, and a search: for the shelves outside a folder. */}
      {!folder && (
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
      )}

      {/* In a folder, its books stand newest first (or A to Z); the shelves by kind are outside it. */}
      {!(folder && view === "books") && (
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
          {view === "books" && !folder && !making && books.length > 1 && (
            <button type="button" className="dark-chip make-folder" onClick={() => setMaking("new")}>
              📁 Make a folder
            </button>
          )}
        </div>
      )}
      {!folder && maker}

      {view === "books" &&
        (shownBooks.length === 0 ? (
          nothing
        ) : folder ? (
          <Bookcase label={`The books in ${folder}`} groups={[{ label: folder, books: shownBooks }]} />
        ) : order === "kind" ? (
          <Bookcase
            label="Books by kind"
            groups={shelves.map(([name, g]) => ({ label: name, ...g }))}
            onOpenFolder={(name) => goToFolder(name)}
            fresh={fresh}
          />
        ) : (
          <Bookcase
            label={order === "az" ? "Books from A to Z" : "Newest books first"}
            groups={[{ label: null, folders, books: loose }]}
            onOpenFolder={(name) => goToFolder(name)}
            fresh={fresh}
          />
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
