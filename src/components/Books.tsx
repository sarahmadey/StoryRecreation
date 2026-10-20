import Link from "next/link";
import { ScrollShelf } from "./Shelf";
import { BOOK_KINDS, formatDuration } from "@/lib/shared/options";
import type { Book, BookKind, StoryCard } from "@/lib/shared/types";

const LEATHERS = ["#6b1f2b", "#23432f", "#1f2d4a", "#5a3720", "#4a2a5a", "#2d4f56", "#6b4a1a", "#3a3a2a"];

export function hueFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return LEATHERS[Math.abs(h) % LEATHERS.length];
}

export function emojiFor(kind: BookKind, notes?: string | null): string {
  // Classics remember the emblem they were added with.
  if (kind === "classic" && notes && notes.length <= 8) return notes;
  return BOOK_KINDS[kind].emoji;
}

export function Cover({
  id,
  title,
  kind,
  coverUrl,
  notes,
  showTitle = true,
}: {
  id: string;
  title: string;
  kind: BookKind;
  coverUrl: string | null;
  notes?: string | null;
  showTitle?: boolean;
}) {
  if (coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coverUrl} alt="" loading="lazy" />;
  }
  return (
    <div className="leather" style={{ ["--hue" as string]: hueFor(id) }}>
      <span className="leather-emoji">{emojiFor(kind, notes)}</span>
      {showTitle && <span className="leather-title">{title}</span>}
    </div>
  );
}

export function BookOnShelf({ book }: { book: Book }) {
  return (
    <Link href={`/books/${book.id}`} className="book" title={book.title}>
      {book.storyCount > 0 && (
        <span className="seal" aria-label={`${book.storyCount} stories`}>
          {book.storyCount}
        </span>
      )}
      <div className="book-cover">
        <Cover id={book.id} title={book.title} kind={book.kind} coverUrl={book.coverUrl} notes={book.notes} />
      </div>
      <div className="book-title">{book.title}</div>
    </Link>
  );
}

export function Shelf({ label, books, empty }: { label: string; books: Book[]; empty?: React.ReactNode }) {
  return (
    <ScrollShelf label={label} count={books.length}>
      {books.length ? books.map((b) => <BookOnShelf key={b.id} book={b} />) : <div className="shelf-empty">{empty}</div>}
    </ScrollShelf>
  );
}

const STATUS: Record<string, { label: string; className: string } | undefined> = {
  writing: { label: "✒️ being written", className: "badge" },
  draft: { label: "📜 ready to review", className: "badge" },
  recording: { label: "🎙️ recording", className: "badge" },
  error: { label: "needs a grown-up", className: "badge badge-velvet" },
};

export function StoryCardView({ story, profileEmoji }: { story: StoryCard; profileEmoji?: string }) {
  const ready = story.status === "ready";
  const status = STATUS[story.status];
  const card = (
    <Link href={ready ? `/play/${story.id}` : `/stories/${story.id}`} className="story-card">
      <div className="story-thumb">
        <Cover id={story.bookId} title={story.bookTitle} kind={story.bookKind} coverUrl={story.coverUrl} showTitle={false} />
      </div>
      <div className="story-meta">
        <div className="story-title">
          {story.favorite && <span aria-label="Favorite">⭐ </span>}
          {story.title}
        </div>
        <div className="story-sub">
          {story.mode === "read" ? "Read aloud · " : ""}
          {ready ? formatDuration(story.duration) : null}
          {status && <span className={status.className}>{status.label}</span>}
          {profileEmoji && <span> · {profileEmoji}</span>}
        </div>
      </div>
      {ready && (
        <span className="play-dot" aria-hidden="true">
          ▶
        </span>
      )}
    </Link>
  );
  if (!ready) return card;
  // A finished story opens straight into the player; its words, voices and sounds are one tap away.
  return (
    <div className="story-card-wrap">
      {card}
      <Link href={`/stories/${story.id}`} className="story-edit" aria-label={`Edit ${story.title}`} title="Edit the words, voices and sounds">
        ✎
      </Link>
    </div>
  );
}
