"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { Cover, StoryCardView, hueFor } from "@/components/Books";
import { ScrollShelf } from "@/components/Shelf";
import { PhotoPicker, VoicePicker, useVoices } from "@/components/Pickers";
import type { PickedPhoto } from "@/lib/client/images";
import { DEFAULT_NARRATOR_ID } from "@/lib/shared/personas";
import { defaultSettings } from "@/lib/shared/options";
import type { AppStatus, Book, Profile, StoryCard } from "@/lib/shared/types";
import type { CatalogueHit, CataloguePage, Classic, TOPICS } from "@/lib/server/classics";

type Tab = "classics" | "own" | "words";
type Topic = (typeof TOPICS)[number];

/** The treasury by the age each book is pitched at ("Ages 4+"). */
const AGES_BANDS = [
  { id: "all", label: "All ages", fits: () => true },
  { id: "little", label: "Little ones", fits: (min: number) => min <= 4 },
  { id: "middle", label: "Ages 5–7", fits: (min: number) => min >= 5 && min <= 7 },
  { id: "older", label: "8 and up", fits: (min: number) => min >= 8 },
] as const;

/** A book from the whole library: its real Gutenberg cover, or a leather one if there isn't a cover. */
function CatalogueBook({ hit, onOpen }: { hit: CatalogueHit; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <button type="button" className="book catalogue-book" onClick={onOpen} title={hit.title}>
      <div className="book-cover">
        {hit.cover && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hit.cover} alt="" loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <div className="leather" style={{ ["--hue" as string]: hueFor(String(hit.gutenbergId)) }}>
            <span className="leather-emoji">📖</span>
            <span className="leather-title">{hit.title}</span>
          </div>
        )}
      </div>
      <div className="book-title">{hit.title}</div>
      {hit.author && <div className="faint small center">{hit.author}</div>}
    </button>
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
}: {
  classics: Classic[];
  topics: readonly Topic[];
  ownBooks: Book[];
  readAlouds: StoryCard[];
  profiles: Profile[];
  status: AppStatus;
  preselectBook: string | null;
  preselectClassic: number | null;
}) {
  const api = useApi();
  const router = useRouter();
  const voices = useVoices();
  const [reader, setReader] = useState<string>(DEFAULT_NARRATOR_ID);
  const [fullCast, setFullCast] = useState(false);
  const [tab, setTab] = useState<Tab>(preselectBook ? "own" : "classics");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // classics
  const [open, setOpen] = useState<{ gid: number; title: string; author: string | null; emoji: string; chapters: ChapterInfo[] } | null>(null);
  const [query, setQuery] = useState("");
  const [ages, setAges] = useState<(typeof AGES_BANDS)[number]["id"]>("all");
  const [topic, setTopic] = useState<string>(topics[0]?.id ?? "loved");
  const [searched, setSearched] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<(CataloguePage & { page: number }) | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const browseSeq = useRef(0);
  const tabsRef = useRef<HTMLDivElement>(null);

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
    // A book tapped far down the page opens up here, by the tabs: bring the family along.
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const res = await api.get<{ title: string; author: string | null; chapters: ChapterInfo[] }>(`/api/classics/${gid}`);
      setOpen({ gid, title: res.title, author: res.author, emoji, chapters: res.chapters });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That book couldn't be fetched.");
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (preselectClassic) void openClassic(preselectClassic, "the book", "📜");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectClassic]);

  /** A page of the whole library, by topic or by search. A later request always wins over an earlier one. */
  const browse = async (by: { topic?: string; q?: string }, page = 1) => {
    const seq = ++browseSeq.current;
    setBrowsing(true);
    setBrowseError(null);
    if (page === 1) setCatalogue(null);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (by.q) params.set("q", by.q);
      else if (by.topic) params.set("topic", by.topic);
      const res = await api.get<CataloguePage>(`/api/classics?${params}`);
      if (seq !== browseSeq.current) return;
      setCatalogue((cur) => ({ results: page > 1 && cur ? [...cur.results, ...res.results] : res.results, more: res.more, page }));
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

  const chooseTopic = (id: string) => {
    setTopic(id);
    setSearched(null);
    setQuery("");
    void browse({ topic: id });
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearched(q);
    void browse({ q });
  };

  const clearSearch = () => {
    setSearched(null);
    setQuery("");
    void browse({ topic });
  };

  // One set of choices for everything below: the favorites follow the age, the kind and the search; the
  // wider library follows the kind and the search (it isn't sorted by age).
  const fits = AGES_BANDS.find((b) => b.id === ages)!.fits;
  const sought = searched?.toLowerCase();
  const favorites = classics.filter(
    (c) =>
      fits(parseInt(c.ages, 10) || 0) &&
      (sought ? `${c.title} ${c.author}`.toLowerCase().includes(sought) : topic === "loved" || (c.kinds as string[]).includes(topic)),
  );
  const topicLabel = topics.find((t) => t.id === topic)?.label ?? "browsing";

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
      <div className="center">
        <div className="eyebrow">Read to Me</div>
        <h1>Who shall read to you?</h1>
        <p className="muted">Pick a storyteller, then pick a book.</p>
      </div>

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
      </div>

      <div className="chips" role="tablist" style={{ justifyContent: "center", scrollMarginTop: 96 }} ref={tabsRef}>
        {(
          [
            ["classics", "📜 The Classic Treasury"],
            ["own", "📕 A book we own"],
            ["words", "✉️ Our own words"],
          ] as const
        ).map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className="dark-chip" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="notice notice-error center">{error}</p>}
      {busy && <p className="notice center">✨ {busy}</p>}

      {tab === "classics" && !open && (
        <>
          <section className="find-panel stack" style={{ ["--gap" as string]: "14px" }} aria-label="Find a book">
            <form className="find-search" onSubmit={search} role="search">
              <input
                className="input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or author"
                aria-label="Search by title or author"
                enterKeyHint="search"
              />
              <button className="btn btn-sm" aria-label="Search">
                🔍
              </button>
            </form>
            <div>
              <span className="find-label">Kind of story</span>
              <div className="topic-chips">
                {topics.map((t) => (
                  <button key={t.id} type="button" className="dark-chip" aria-pressed={!searched && topic === t.id} onClick={() => chooseTopic(t.id)}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="find-label">Age</span>
              <div className="topic-chips">
                {AGES_BANDS.map((b) => (
                  <button key={b.id} type="button" className="dark-chip" aria-pressed={ages === b.id} onClick={() => setAges(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
            {searched && (
              <p className="center muted" style={{ margin: 0 }}>
                Books matching “{searched}” ·{" "}
                <button type="button" className="btn btn-quiet btn-sm" onClick={clearSearch}>
                  ✕ Back to {topicLabel}
                </button>
              </p>
            )}
          </section>

          {favorites.length > 0 && (
            <div className="bookcase">
              <ScrollShelf label="Storyhollow favorites" count={favorites.length}>
                {favorites.map((c) => (
                  <button
                    key={c.slug}
                    className="book"
                    onClick={() => openClassic(c.gutenbergId, c.title, c.emoji)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    <div className="book-cover">
                      <div className="leather" style={{ ["--hue" as string]: c.color }}>
                        <span className="leather-emoji">{c.emoji}</span>
                        <span className="leather-title">{c.title}</span>
                      </div>
                    </div>
                    <div className="book-title">{c.title}</div>
                    <div className="faint small center">Ages {c.ages}</div>
                  </button>
                ))}
              </ScrollShelf>
            </div>
          )}

          <section className="stack" style={{ ["--gap" as string]: "14px" }}>
            <div className="center">
              <h2 style={{ margin: 0 }}>{searched ? "From the whole library" : `${topicLabel} from the whole library`}</h2>
              <p className="muted small" style={{ margin: "4px 0 0" }}>
                Free books from Project Gutenberg, most read first.
                {ages !== "all" ? " These aren't sorted by age, so do look at the covers." : ""}
              </p>
            </div>
            {browseError && (
              <div className="notice notice-error center">
                <p style={{ margin: 0 }}>{browseError}</p>
                <button type="button" className="btn btn-sm" style={{ marginTop: 10 }} onClick={() => browse(searched ? { q: searched } : { topic }, (catalogue?.page ?? 0) + 1)}>
                  Try again
                </button>
              </div>
            )}
            {catalogue && catalogue.results.length > 0 && (
              <div className="catalogue-grid">
                {catalogue.results.map((hit) => (
                  <CatalogueBook key={hit.gutenbergId} hit={hit} onOpen={() => openClassic(hit.gutenbergId, hit.title, "📖")} />
                ))}
              </div>
            )}
            {catalogue && catalogue.results.length === 0 && !browsing && <p className="muted center">Nothing found. Try another title, or another kind of story.</p>}
            {browsing && <p className="notice center">✨ Opening the card catalogue… the first look can take a few seconds.</p>}
            {catalogue?.more && !browsing && (
              <div className="center">
                <button type="button" className="btn btn-ghost" onClick={() => browse(searched ? { q: searched } : { topic }, catalogue.page + 1)}>
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
        <div className="parchment stack">
          <div className="spread">
            <div>
              <div className="eyebrow">{open.author}</div>
              <h2 style={{ margin: 0 }}>
                {open.emoji} {open.title}
              </h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>
              ← All books
            </button>
          </div>
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            {open.chapters.map((c) => (
              <div key={c.index} className="cast-card spread" style={{ alignItems: "center" }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="cast-name">{c.title}</div>
                  <div className="small muted">
                    About {minutes(c.words)} min · {c.characters.toLocaleString()} voice characters
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
          <div className="center">
            <button className="btn btn-lg" onClick={readWords} disabled={Boolean(busy) || words.trim().length < 10}>
              🎧 Read it to me
            </button>
          </div>
        </div>
      )}

      {readAlouds.length > 0 && (
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
