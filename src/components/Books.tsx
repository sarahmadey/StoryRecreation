import Link from "next/link";
import { BOOK_KINDS, formatDuration } from "@/lib/shared/options";
import { LANGUAGES } from "@/lib/shared/languages";
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

/** Books whose covers have no words of their own: a dreamed-up tale's is drawn by the illustrator, and one from the wild is the family's photo. */
const WORDLESS = new Set<BookKind>(["idea", "wild"]);

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
  // A cover photo lies over the leather one, which shows through if the photo can't be fetched. A picture with no
  // words on it has the book's name across the top, in the calm space the illustrator leaves there for it.
  const nameOnTop = showTitle && Boolean(coverUrl) && WORDLESS.has(kind);
  return (
    <div className="leather" style={{ ["--hue" as string]: hueFor(id) }}>
      <span className="leather-emoji">{emojiFor(kind, notes)}</span>
      {showTitle && !nameOnTop && <span className="leather-title">{title}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {coverUrl && <img className="cover-photo" src={coverUrl} alt="" loading="lazy" />}
      {nameOnTop && (
        <span className="cover-title">
          <span>{title}</span>
        </span>
      )}
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
      {book.favorite && (
        <span className="shelf-star" aria-label="A favorite">
          ★
        </span>
      )}
      <div className="book-cover">
        <Cover id={book.id} title={book.title} kind={book.kind} coverUrl={book.coverUrl} notes={book.notes} />
      </div>
      <div className="book-title">{book.title}</div>
    </Link>
  );
}

const STATUS: Record<string, { label: string; className: string } | undefined> = {
  writing: { label: "✒️ being written", className: "badge" },
  draft: { label: "📜 ready to review", className: "badge" },
  recording: { label: "🎙️ recording", className: "badge" },
  error: { label: "needs a grown-up", className: "badge badge-velvet" },
};

/** inBook: shown on its own book's page, so the book's name isn't repeated. */
export function StoryCardView({ story, profileEmoji, inBook }: { story: StoryCard; profileEmoji?: string; inBook?: boolean }) {
  const ready = story.status === "ready";
  const status = STATUS[story.status];
  // A chapter ("Part 1") is named by its book, with the chapter beneath, except on the book's own page.
  const chapter = !inBook && story.bookKind === "classic" && story.title.toLowerCase() !== story.bookTitle.toLowerCase();
  const card = (
    <Link href={ready ? `/play/${story.id}` : `/stories/${story.id}`} className="story-card">
      <div className="story-thumb">
        <Cover id={story.bookId} title={story.bookTitle} kind={story.bookKind} coverUrl={story.coverUrl} showTitle={false} />
      </div>
      <div className="story-meta">
        <div className="story-title">
          {story.favorite && <span aria-label="Favorite">⭐ </span>}
          {chapter ? story.bookTitle : story.title}
        </div>
        {story.narrator && (
          <div className="story-sub story-narrator">
            {story.narrator.emoji} {story.narrator.name}
          </div>
        )}
        <div className="story-sub">
          {[
            // which book it's from (or, for a chapter, which chapter), unless the title already says
            chapter ? story.title : inBook || story.title.toLowerCase().includes(story.bookTitle.toLowerCase()) ? null : story.bookTitle,
            story.language ? LANGUAGES[story.language].in : null,
            story.mode === "read" ? "read aloud" : null,
            ready ? formatDuration(story.duration) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
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
