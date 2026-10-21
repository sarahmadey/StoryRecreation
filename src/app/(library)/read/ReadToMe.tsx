"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { Cover, StoryCardView, hueFor } from "@/components/Books";
import { Steps, toTop } from "@/components/Steps";
import { CreditNote, CreditsLeft, useCredits } from "@/components/Credits";
import { PhotoPicker, VoicePicker, useVoices } from "@/components/Pickers";
import type { PickedPhoto } from "@/lib/client/images";
import { DEFAULT_NARRATOR_ID } from "@/lib/shared/personas";
import { defaultSettings } from "@/lib/shared/options";
import { gutenbergCover } from "@/lib/shared/gutenberg";
import type { AppStatus, Book, Profile, StoryCard } from "@/lib/shared/types";
import type { CataloguePage, Classic, Refinement, TOPICS } from "@/lib/server/classics";
import type { FavoriteClassic } from "@/lib/server/db";

type Tab = "classics" | "own" | "words";
type Topic = (typeof TOPICS)[number];

/** The whole library opens a couple of rows deep, and grows a few rows at a time. */
const FIRST_ROWS = 2;
const MORE_ROWS = 3;

/** A book to choose: its real Gutenberg cover (or a leather one), its title, and a star to keep it handy. */
function BookTile({
  book,
  sub,
  hue,
  starred,
  onOpen,
  onStar,
  className = "",
}: {
  book: FavoriteClassic;
  sub: string | null;
  hue: string;
  starred: boolean;
  onOpen: () => void;
  onStar: () => void;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <div className={`book ${className}`}>
      <button type="button" className="book-open" onClick={onOpen} title={book.title}>
        <div className="book-cover">
          {book.cover && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={book.cover} alt="" loading="lazy" onError={() => setBroken(true)} />
          ) : (
            <div className="leather" style={{ ["--hue" as string]: hue }}>
              <span className="leather-emoji">{book.emoji ?? "📖"}</span>
              <span className="leather-title">{book.title}</span>
            </div>
          )}
        </div>
        <div className="book-title">{book.title}</div>
        {sub && <div className="faint small center">{sub}</div>}
      </button>
      <button
        type="button"
        className="fav-star"
        aria-pressed={starred}
        aria-label={starred ? `Take ${book.title} out of favorites` : `Make ${book.title} a favorite`}
        onClick={onStar}
      >
        {starred ? "★" : "☆"}
      </button>
    </div>
  );
}

interface ChapterInfo {
  index: number;
  title: string;
  words: number;
  characters: number;
  opening: string;
}

export function ReadToMe({
  classics,
  topics,
  ownBooks,
  readAlouds,
  profiles,
  status,
  preselectBook,
  preselectClassic,
  favoriteClassics,
  librarySize,
}: {
  classics: Classic[];
  topics: readonly Topic[];
  ownBooks: Book[];
  readAlouds: StoryCard[];
  profiles: Profile[];
  status: AppStatus;
  preselectBook: string | null;
  preselectClassic: number | null;
  favoriteClassics: FavoriteClassic[];
  /** How many books the whole library holds (0 until it's first fetched). */
  librarySize: number;
}) {
  const api = useApi();
  const router = useRouter();
  const voices = useVoices();
  const credits = useCredits();
  const [reader, setReader] = useState<string>(DEFAULT_NARRATOR_ID);
  const [fullCast, setFullCast] = useState(false);
  const [tab, setTab] = useState<Tab>(preselectBook ? "own" : "classics");
  // First the storyteller, then the book. Arriving from a book's page, the book is already chosen.
  const [step, setStep] = useState(preselectBook || preselectClassic ? 1 : 0);
  const goTo = (next: number) => {
    setStep(next);
    toTop();
  };
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // classics
  const [open, setOpen] = useState<{ gid: number; title: string; author: string | null; emoji: string; chapters: ChapterInfo[] } | null>(null);
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>(topics[0]?.id ?? "loved");
  const [searched, setSearched] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<(CataloguePage & { page: number }) | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  // Narrowing a long list down by a subject its books share ("Dogs · 84").
  const [refine, setRefine] = useState<Refinement | null>(null);
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const browseSeq = useRef(0);
  const [rows, setRows] = useState(FIRST_ROWS);
  const [cols, setCols] = useState(3);
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const shelfScroll = useRef(0);
  const openRef = useRef<HTMLDivElement>(null);

  // own book
  const [bookId, setBookId] = useState<string>(preselectBook ?? ownBooks[0]?.id ?? "new");
  const [newTitle, setNewTitle] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [checkFirst, setCheckFirst] = useState(false);

  // own words
  const [wordsTitle, setWordsTitle] = useState("");
  const [words, setWords] = useState("");

  const storytellerReady = status.storyteller || status.demoMode;
  const emojiOf = new Map(profiles.map((p) => [p.id, p.avatar]));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("storyhollow:reader");
      if (saved) setReader(saved);
    } catch {
      // ignore
    }
  }, []);
  const readerVoice = voices?.find((v) => v.voiceId === reader);
  const readerName = readerVoice
    ? `${readerVoice.persona?.emoji ?? (readerVoice.source === "family" ? "💛" : readerVoice.source === "designed" ? "🪄" : "🗣️")} ${readerVoice.persona?.name ?? readerVoice.name}`
    : "your storyteller";
  const chooseReader = (id: string | null) => {
    const v = id ?? DEFAULT_NARRATOR_ID;
    setReader(v);
    try {
      localStorage.setItem("storyhollow:reader", v);
    } catch {
      // ignore
    }
  };

  const openClassic = async (gid: number, fallbackTitle: string, emoji: string) => {
    setBusy(`Fetching ${fallbackTitle} from the archives…`);
    setError(null);
    // The book opens at the top of the page; "All books" brings the family back to where they were.
    shelfScroll.current = window.scrollY;
    toTop();
    try {
      const res = await api.get<{ title: string; author: string | null; chapters: ChapterInfo[] }>(`/api/classics/${gid}`);
      setOpen({ gid, title: res.title, author: res.author, emoji, chapters: res.chapters });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That book couldn't be fetched.");
    } finally {
      setBusy(null);
    }
  };

  // An opened book lands at the top of the screen, its chapters in view.
  useEffect(() => {
    if (open) openRef.current?.scrollIntoView({ block: "start" });
  }, [open]);

  const closeClassic = () => {
    setOpen(null);
    requestAnimationFrame(() => window.scrollTo({ top: shelfScroll.current }));
  };

  useEffect(() => {
    if (preselectClassic) void openClassic(preselectClassic, "the book", "📜");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectClassic]);

  /** A page of the whole library, by topic or by search. A later request always wins over an earlier one. */
  const browse = async (by: { topic?: string; q?: string; refine?: string }, page = 1) => {
    const seq = ++browseSeq.current;
    setBrowsing(true);
    setBrowseError(null);
    if (page === 1) {
      setCatalogue(null);
      setRows(FIRST_ROWS);
    }
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (by.q) params.set("q", by.q);
      else if (by.topic) params.set("topic", by.topic);
      if (by.refine) params.set("refine", by.refine);
      const res = await api.get<CataloguePage>(`/api/classics?${params}`);
      if (seq !== browseSeq.current) return;
      if (res.refinements) setRefinements(res.refinements);
      setCatalogue((cur) => ({ results: page > 1 && cur ? [...cur.results, ...res.results] : res.results, more: res.more, total: res.total, page }));
    } catch (err) {
      if (seq === browseSeq.current) setBrowseError(err instanceof Error ? err.message : "The library couldn't be reached.");
    } finally {
      if (seq === browseSeq.current) setBrowsing(false);
    }
  };

  // Open the card catalogue at the first topic the first time the treasury is shown.
  useEffect(() => {
    if (tab === "classics" && !catalogue && !browsing && !browseError) void browse({ topic });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // How many books fit across, so "two rows" is two rows on a phone and on a big screen alike.
  useEffect(() => {
    if (!gridEl) return;
    const measure = () => setCols(Math.max(1, getComputedStyle(gridEl).gridTemplateColumns.split(" ").filter(Boolean).length));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [gridEl]);
  // What's being looked at: a search or a kind, and what it's narrowed to.
  const lookingAt = (narrowed = refine) => ({ ...(searched ? { q: searched } : { topic }), refine: narrowed?.id });
  const startOver = () => {
    setRefine(null);
    setRefinements([]);
  };

  const chooseTopic = (id: string) => {
    setTopic(id);
    setRows(FIRST_ROWS);
    setSearched(null);
    setQuery("");
    startOver();
    if (id !== "favorites") void browse({ topic: id });
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearched(q);
    startOver();
    void browse({ q });
  };

  const clearSearch = () => {
    setSearched(null);
    setQuery("");
    startOver();
    if (topic !== "favorites") void browse({ topic });
  };

  const narrow = (r: Refinement | null) => {
    setRefine(r);
    void browse(lookingAt(r));
  };

  // Starred books, for the whole family. Each keeps its title and cover so it shows without the library.
  const [starredBooks, setStarredBooks] = useState<FavoriteClassic[]>(favoriteClassics);
  const isStarred = (gid: number) => starredBooks.some((b) => b.gutenbergId === gid);
  const toggleStar = (book: FavoriteClassic) => {
    const favorite = !isStarred(book.gutenbergId);
    const apply = (on: boolean) =>
      setStarredBooks((cur) => (on ? [book, ...cur.filter((b) => b.gutenbergId !== book.gutenbergId)] : cur.filter((b) => b.gutenbergId !== book.gutenbergId)));
    apply(favorite);
    api.post("/api/favorites", { book, favorite }).catch(() => apply(!favorite));
  };
  const pick = (c: Classic): FavoriteClassic => ({
    gutenbergId: c.gutenbergId,
    title: c.title,
    author: c.author,
    cover: gutenbergCover(c.gutenbergId),
    emoji: c.emoji,
  });

  // One search, one set of results: Storyhollow's own picks for this kind (or search) first, then the rest of the library.
  const kinds = [{ id: "favorites", label: "Favorites", emoji: "⭐" }, ...topics];
  const showingStarred = topic === "favorites" && !searched;
  const sought = searched?.toLowerCase();
  // Narrowed by a subject, it's the library's own list (Storyhollow's picks have no subjects of their own).
  const picks = refine
    ? []
    : classics.filter((c) =>
        sought ? `${c.title} ${c.author}`.toLowerCase().includes(sought) : topic === "loved" || (c.kinds as string[]).includes(topic),
      );
  const picked = new Set(picks.map((c) => c.gutenbergId));
  const results: FavoriteClassic[] = showingStarred
    ? starredBooks
    : [
        ...picks.map(pick),
        ...(catalogue?.results ?? [])
          .filter((hit) => !picked.has(hit.gutenbergId))
          .map((hit) => ({ gutenbergId: hit.gutenbergId, title: hit.title, author: hit.author, cover: hit.cover, emoji: null })),
      ];
  const total = showingStarred ? starredBooks.length : Math.max(catalogue?.total ?? 0, results.length);
  const shown = results.slice(0, rows * cols);
  const canShowMore = shown.length < results.length || (!showingStarred && Boolean(catalogue?.more));
  const showMore = () => {
    const next = rows + MORE_ROWS;
    setRows(next);
    // Fetch the next page from the library before running out of books to show.
    if (!showingStarred && catalogue?.more && next * cols > results.length) void browse(lookingAt(), catalogue.page + 1);
  };
  const topicLabel = kinds.find((t) => t.id === topic)?.label ?? "browsing";
  const tileFor = (book: FavoriteClassic, className?: string) => {
    const curated = classics.find((c) => c.gutenbergId === book.gutenbergId);
    return (
      <BookTile
        key={book.gutenbergId}
        book={curated ? pick(curated) : book}
        sub={curated ? `Ages ${curated.ages}` : book.author}
        hue={curated?.color ?? hueFor(String(book.gutenbergId))}
        starred={isStarred(book.gutenbergId)}
        onOpen={() => openClassic(book.gutenbergId, book.title, curated?.emoji ?? book.emoji ?? "📖")}
        onStar={() => toggleStar(curated ? pick(curated) : book)}
        className={className}
      />
    );
  };

  const baseSettings = (source: "classic" | "book_read" | "text") =>
    defaultSettings({
      source,
      narratorVoiceId: reader,
      fullCast,
      chime: { enabled: source === "book_read", style: "bell", gapSeconds: 3 },
      intro: true,
      review: source === "book_read" ? checkFirst : false,
    });

  const readChapter = async (chapter: ChapterInfo) => {
    if (!open) return;
    setBusy("Opening the book…");
    setError(null);
    try {
      const { id } = await api.post<{ id: string }>("/api/classics/read", {
        gutenbergId: open.gid,
        chapter: chapter.index,
        emoji: open.emoji,
        settings: baseSettings("classic"),
      });
      router.push(`/stories/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(null);
    }
  };

  const readOwnBook = async () => {
    setBusy("Opening your book…");
    setError(null);
    try {
      let id = bookId;
      if (bookId === "new") {
        const form = new FormData();
        form.set("title", newTitle.trim() || "Our Book");
        form.set("kind", "picture_book");
        photos.forEach((p) => form.append("pages", p.file, p.file.name));
        id = (await api.form<{ id: string }>("/api/books", form)).id;
      }
      const res = await api.post<{ id: string }>("/api/stories", { bookId: id, mode: "read", settings: baseSettings("book_read") });
      router.push(`/stories/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(null);
    }
  };

  const readWords = async () => {
    setBusy("Opening the envelope…");
    setError(null);
    try {
      const form = new FormData();
      form.set("title", wordsTitle.trim() || "Our Words");
      form.set("kind", "own_text");
      const { id: bookIdNew } = await api.form<{ id: string }>("/api/books", form);
      const res = await api.post<{ id: string }>("/api/stories", {
        bookId: bookIdNew,
        mode: "read",
        settings: { ...baseSettings("text"), text: words },
      });
      router.push(`/stories/${res.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(null);
    }
  };

  const minutes = (w: number) => Math.max(1, Math.round(w / 150));

  return (
    <div className="stack" style={{ ["--gap" as string]: "26px" }}>
      {step === 1 && (
        <button type="button" className="back-link" onClick={() => goTo(0)} style={{ marginBottom: -12 }}>
          ‹ Back to the storyteller
        </button>
      )}
      <div className="center">
        <div className="eyebrow">Read to Me</div>
        <h1>{step === 0 ? "Who shall read to you?" : "What shall we read?"}</h1>
      </div>
      <Steps labels={["The storyteller", "The book"]} step={step} onGo={goTo} />

      {step === 0 && (
        <div className="parchment stack">
          <VoicePicker voices={voices} value={reader} onChange={chooseReader} allowAuto={false} />
          <label className="toggle">
            <input type="checkbox" checked={fullCast} onChange={(e) => setFullCast(e.target.checked)} disabled={!storytellerReady} />
            <span>
              <b>Character voices</b>
              <span className="muted small">
                {storytellerReady
                  ? "Your storyteller reads the narration, and every character who speaks gets a voice of their own."
                  : "Needs the storyteller (an Anthropic key) to work out who's talking."}
              </span>
            </span>
          </label>
          <div className="spread">
            <span />
            <button className="btn" type="button" onClick={() => goTo(1)}>
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <>
          <p className="center muted" style={{ margin: 0 }}>
            Read by <b>{readerName}</b>
            {fullCast ? ", with a voice for every character" : ""} ·{" "}
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => goTo(0)}>
              Change
            </button>
          </p>
          <div className="chips read-tabs" role="tablist" style={{ justifyContent: "center" }}>
            {(
              [
                ["classics", "📜", "The Classic Treasury"],
                ["own", "📕", "A book we own"],
                ["words", "✉️", "Our own words"],
              ] as const
            ).map(([t, emoji, label]) => (
              <button key={t} role="tab" aria-selected={tab === t} className="dark-chip" aria-pressed={tab === t} onClick={() => setTab(t)}>
                <span className="tab-emoji" aria-hidden="true">
                  {emoji}
                </span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {error && <p className="notice notice-error center">{error}</p>}
          {busy && <p className="notice center">✨ {busy}</p>}

          {tab === "classics" && !open && (
            <>
              <section className="find-panel stack" style={{ ["--gap" as string]: "14px" }} aria-label="Find a book">
                <div>
                  <p className="find-intro">
                    📚 <b>{librarySize ? librarySize.toLocaleString() : "Tens of thousands of"} free books</b> from Project Gutenberg, the great
                    free library of classics.
                  </p>
                  <form className="find-search" onSubmit={search} role="search">
                    <input
                      className="input"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by title, author or subject"
                      aria-label="Search by title, author or subject"
                      enterKeyHint="search"
                    />
                    <button className="btn btn-sm" aria-label="Search">
                      🔍
                    </button>
                  </form>
                  <p className="find-hint">Try a title (“Peter Pan”), an author (“Beatrix Potter”) or a subject (“pirates”, “Halloween”, “dragons”).</p>
                </div>
                <div>
                  <span className="find-label">Or browse a kind of story</span>
                  <div className="topic-chips">
                    {kinds.map((t) => (
                      <button key={t.id} type="button" className="dark-chip" aria-pressed={!searched && topic === t.id} onClick={() => chooseTopic(t.id)}>
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="stack" style={{ ["--gap" as string]: "14px" }} aria-label="Books">
                <div className="center">
                  <h2 style={{ margin: 0 }}>
                    {showingStarred ? "Your favorites" : searched ? `Books matching “${searched}”` : topicLabel}
                    {refine ? ` · ${refine.label}` : ""}
                  </h2>
                  <p className="muted small" style={{ margin: "4px 0 0" }}>
                    {showingStarred
                      ? "The books anyone in the family has starred."
                      : catalogue
                        ? refine
                          ? `${total.toLocaleString()} ${total === 1 ? "book" : "books"}`
                          : `${total.toLocaleString()} ${total === 1 ? "book" : "books"} · Storyhollow's picks first (with ages), then the rest of the library.`
                        : "Storyhollow's picks first (with ages), then the rest of the library."}
                    {searched && (
                      <>
                        {" "}
                        <button type="button" className="btn btn-quiet btn-sm" onClick={clearSearch}>
                          ✕ Clear search
                        </button>
                      </>
                    )}
                  </p>
                </div>
                {!showingStarred && refinements.length > 0 && (
                  <div>
                    <span className="find-label">Narrow it down</span>
                    <div className="topic-chips">
                      <button type="button" className="dark-chip" aria-pressed={!refine} onClick={() => narrow(null)}>
                        All
                      </button>
                      {refinements.map((r) => (
                        <button key={r.id} type="button" className="dark-chip" aria-pressed={refine?.id === r.id} onClick={() => narrow(r)}>
                          {r.label} <span className="chip-count">{r.count.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {browseError && (
                  <div className="notice notice-error center">
                    <p style={{ margin: 0 }}>{browseError}</p>
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginTop: 10 }}
                      onClick={() => browse(lookingAt(), (catalogue?.page ?? 0) + 1)}
                    >
                      Try again
                    </button>
                  </div>
                )}
                {results.length > 0 && (
                  <div className="catalogue-grid" ref={setGridEl}>
                    {shown.map((b) => tileFor(b, "catalogue-book"))}
                  </div>
                )}
                {showingStarred && results.length === 0 && (
                  <p className="muted center">Tap the ☆ on any book to keep it here, for everyone in the family.</p>
                )}
                {!showingStarred && catalogue && results.length === 0 && !browsing && (
                  <p className="muted center">Nothing found. Try another title, an author, or another kind of story.</p>
                )}
                {browsing && (
                  <p className="notice center">
                    {catalogue ? "✨ Fetching more books…" : "✨ Opening the card catalogue… the first look can take a few seconds."}
                  </p>
                )}
                {canShowMore && !browsing && (
                  <div className="center">
                    <button type="button" className="btn btn-ghost" onClick={showMore}>
                      Show more books
                    </button>
                  </div>
                )}
              </section>

              <p className="faint small center">
                Newer picture books aren't in any free library, so photograph your own copy instead (“A book we own”).
              </p>
            </>
          )}

          {tab === "classics" && open && (
            <div className="parchment stack opened-book" ref={openRef}>
              <div className="spread">
                <div>
                  <div className="eyebrow">{open.author}</div>
                  <h2 style={{ margin: 0 }}>
                    {open.emoji} {open.title}
                  </h2>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={closeClassic}>
                  ← All books
                </button>
              </div>
              <CreditsLeft className="small muted" />
              <div className="stack" style={{ ["--gap" as string]: "10px" }}>
                {open.chapters.map((c) => (
                  <div key={c.index} className="cast-card spread" style={{ alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="cast-name">{c.title}</div>
                      <div className="small muted">
                        About {minutes(c.words)} min · about {c.characters.toLocaleString()} voice credits
                        {credits && c.characters > credits.left && <b className="over-budget"> · more than you have left</b>}
                      </div>
                      <div className="small faint" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.opening}…
                      </div>
                    </div>
                    <button className="btn btn-sm" onClick={() => readChapter(c)} disabled={Boolean(busy)}>
                      🎧 {open.chapters.length === 1 ? "Read it to me" : "Read this"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "own" && (
            <div className="parchment stack">
              <p className="muted" style={{ margin: 0 }}>
                Photograph the pages of a book you own, and your storyteller will read its real words aloud, with a chime to turn
                each page. (For your family's own listening.)
              </p>
              <div className="choices" style={{ ["--min" as string]: "120px" }}>
                {ownBooks.map((b) => (
                  <button key={b.id} type="button" className="choice" aria-pressed={bookId === b.id} onClick={() => setBookId(b.id)} style={{ padding: 10 }}>
                    <div className="story-thumb" style={{ width: 66, height: 88 }}>
                      <Cover id={b.id} title={b.title} kind={b.kind} coverUrl={b.coverUrl} showTitle={false} />
                    </div>
                    <span className="choice-title" style={{ fontSize: "1rem" }}>
                      {b.title}
                    </span>
                  </button>
                ))}
                <button type="button" className="choice" aria-pressed={bookId === "new"} onClick={() => setBookId("new")}>
                  <span className="choice-emoji">📷</span>
                  <span className="choice-title">Photograph a book</span>
                </button>
              </div>
              {bookId === "new" && (
                <>
                  <label className="field">
                    <span>Book title</span>
                    <input className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="The Snail Who Wanted to Fly" />
                  </label>
                  <PhotoPicker photos={photos} onChange={setPhotos} />
                </>
              )}
              <label className="toggle">
                <input type="checkbox" checked={checkFirst} onChange={(e) => setCheckFirst(e.target.checked)} />
                <span>
                  <b>Let me check the words before recording</b>
                  <span className="muted small">Handy for tricky fonts or handwriting.</span>
                </span>
              </label>
              {!storytellerReady && <p className="notice small">Reading your own pages needs the storyteller (an Anthropic key).</p>}
              <CreditsLeft className="small muted center" />
              <div className="center">
                <button
                  className="btn btn-lg"
                  onClick={readOwnBook}
                  disabled={Boolean(busy) || !storytellerReady || (bookId === "new" && photos.length === 0)}
                >
                  🎧 Read it to me
                </button>
              </div>
            </div>
          )}

          {tab === "words" && (
            <div className="parchment stack">
              <p className="muted" style={{ margin: 0 }}>
                A poem, a letter from Grandma, a story your child dictated… paste it here and it will be read aloud.
              </p>
              <label className="field">
                <span>Title</span>
                <input className="input" value={wordsTitle} onChange={(e) => setWordsTitle(e.target.value)} placeholder="A Letter from Granny" />
              </label>
              <label className="field">
                <span>The words</span>
                <textarea className="textarea" style={{ minHeight: 220 }} value={words} onChange={(e) => setWords(e.target.value)} />
              </label>
              {words.trim().length >= 10 && <CreditNote needed={words.trim().length} className="small muted center" />}
              <div className="center">
                <button className="btn btn-lg" onClick={readWords} disabled={Boolean(busy) || words.trim().length < 10}>
                  🎧 Read it to me
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {step === 0 && readAlouds.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Read-alouds on your shelves</h2>
          </div>
          <div className="story-list">
            {readAlouds.map((s) => (
              <StoryCardView key={s.id} story={s} profileEmoji={s.profileId ? emojiOf.get(s.profileId) : undefined} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
