"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { Cover, StoryCardView } from "@/components/Books";
import { BOOK_KINDS, DEFAULT_SHELVES, defaultSettings } from "@/lib/shared/options";
import type { Book, BookPage, Profile, StoryCard, StorySettings } from "@/lib/shared/types";

export function BookView({
  book,
  pages,
  stories,
  profiles,
  shelves,
  lastCreate,
  currentProfile,
  canMake,
}: {
  book: Book;
  pages: BookPage[];
  stories: StoryCard[];
  profiles: Profile[];
  shelves: string[];
  lastCreate: StorySettings | null;
  currentProfile: Profile | null;
  canMake: boolean;
}) {
  const api = useApi();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(book.title);
  const [shelf, setShelf] = useState(book.shelf);

  const physical = book.kind === "shadow_book" || book.kind === "picture_book";
  const canCreate = book.kind !== "classic" && book.kind !== "own_text";
  const emojiOf = new Map(profiles.map((p) => [p.id, p.avatar]));
  // A book in the library is usually opened to hear it again, so its stories come first and making a new one second.
  const hasStories = stories.length > 0;
  const makeClass = hasStories ? "btn btn-ghost" : "btn btn-lg";

  const quickStory = async () => {
    setBusy(true);
    setError(null);
    try {
      const base =
        lastCreate ??
        defaultSettings({
          source: book.kind === "wild" ? "wild" : book.kind === "idea" ? "idea" : "book",
          chime: { enabled: physical, style: "bell", gapSeconds: 3 },
          heroes: currentProfile ? [currentProfile.name] : [],
        });
      const settings: StorySettings = { ...base, surprise: true, review: false };
      const { id } = await api.post<{ id: string }>("/api/stories", { bookId: book.id, mode: "create", settings });
      router.push(`/stories/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The storyteller couldn't start.");
      setBusy(false);
    }
  };

  const save = async () => {
    try {
      await api.patch(`/api/books/${book.id}`, { title, shelf });
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    }
  };

  const remove = async () => {
    if (!confirm(`Take "${book.title}" off the shelves? Its ${stories.length} stories will be deleted too.`)) return;
    try {
      await api.del(`/api/books/${book.id}`);
      router.push("/library");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  };

  return (
    <>
      <Link href="/library" className="back-link">
        ‹ Back to the library
      </Link>
      <div className="book-header">
        <div className="book">
          <div className="book-cover">
            <Cover id={book.id} title={book.title} kind={book.kind} coverUrl={book.coverUrl} notes={book.notes} />
          </div>
        </div>
        <div className="stack">
          <div>
            <div className="eyebrow">
              {BOOK_KINDS[book.kind].emoji} {BOOK_KINDS[book.kind].label} · {book.shelf}
            </div>
            {editing ? (
              <div className="stack" style={{ maxWidth: 460 }}>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
                <input className="input" list="shelves" value={shelf} onChange={(e) => setShelf(e.target.value)} aria-label="Shelf" />
                <datalist id="shelves">
                  {[...new Set([...shelves, ...Object.values(DEFAULT_SHELVES)])].map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
                <div className="row">
                  <button className="btn btn-sm" onClick={save}>
                    Save
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                  <button className="btn btn-quiet btn-sm" onClick={remove} style={{ color: "var(--danger)" }}>
                    Remove book
                  </button>
                </div>
              </div>
            ) : (
              <h1 style={{ marginBottom: 4 }}>{book.title}</h1>
            )}
            {book.author && <p className="muted">by {book.author}</p>}
            {pages.length > 0 && <p className="faint small">{pages.length} page photos</p>}
          </div>

          {error && <p className="notice notice-error">{error}</p>}

          {hasStories && (
            <div className="book-stories">
              <div className="find-label">{stories.length === 1 ? "Your story" : `Your ${stories.length} stories`}</div>
              <div className="story-list">
                {stories.map((s) => (
                  <StoryCardView key={s.id} story={s} inBook profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
                ))}
              </div>
            </div>
          )}

          {hasStories && (canCreate || physical || book.kind === "classic") && (
            <div className="find-label" style={{ marginTop: 8 }}>
              Or make something new
            </div>
          )}
          <div className="row">
            {canCreate && (
              <button className={makeClass} onClick={quickStory} disabled={busy || !canMake}>
                {busy ? "Summoning the storyteller…" : "✨ A new story tonight"}
              </button>
            )}
            {canCreate && (
              <Link className="btn btn-ghost" href={`/create?book=${book.id}`}>
                Make one my way
              </Link>
            )}
            {physical && pages.length > 0 && (
              <Link className="btn btn-ghost" href={`/read?book=${book.id}`}>
                🎧 Read the real words to me
              </Link>
            )}
            {book.kind === "classic" && (
              <Link className={hasStories ? "btn btn-ghost" : "btn"} href={`/read?classic=${book.sourceRef}`}>
                🎧 Read another chapter
              </Link>
            )}
          </div>
          {canCreate && (
            <p className="faint small" style={{ marginTop: 6 }}>
              “A new story tonight” writes and records a brand-new tale for these pictures, different from every story
              before it{lastCreate ? ", using the same voices and length as last time" : ""}.
            </p>
          )}
          {!editing && (
            <button className="btn btn-quiet btn-sm" onClick={() => setEditing(true)} style={{ alignSelf: "flex-start" }}>
              ✎ Rename or move shelf
            </button>
          )}
        </div>
      </div>

      {pages.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>The pages</h2>
          </div>
          <div className="page-strip">
            {pages.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={p.imageUrl} alt={`Page ${p.pageNumber}`} loading="lazy" />
            ))}
          </div>
        </section>
      )}

    </>
  );
}
