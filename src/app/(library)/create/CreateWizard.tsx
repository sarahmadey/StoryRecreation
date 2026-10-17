"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { ChimePicker, PhotoPicker, VoicePicker, useVoices } from "@/components/Pickers";
import { Cover } from "@/components/Books";
import type { PickedPhoto } from "@/lib/client/images";
import { AGES, LENGTHS, MOODS, defaultSettings, estimateMinutes } from "@/lib/shared/options";
import type { AgeBand, Book, LengthPreset, Mood, Profile, StorySettings } from "@/lib/shared/types";

type Source = "book" | "wild" | "idea";

const LESSONS = ["Kindness", "Being brave", "Sharing", "Trying new things", "Patience", "Being yourself", "Friendship", "Saying sorry"];

function ageBandFor(age: number | null | undefined): AgeBand {
  if (age == null) return "4-5";
  if (age <= 3) return "2-3";
  if (age <= 5) return "4-5";
  if (age <= 8) return "6-8";
  return "9-12";
}

export function CreateWizard({
  books,
  profiles,
  currentProfile,
  preselect,
  preselectSettings,
}: {
  books: Book[];
  profiles: Profile[];
  currentProfile: Profile | null;
  preselect: Book | null;
  preselectSettings: StorySettings | null;
}) {
  const api = useApi();
  const router = useRouter();
  const voices = useVoices();

  const initialSource: Source = preselect ? (preselect.kind === "wild" ? "wild" : preselect.kind === "idea" ? "idea" : "book") : "book";
  const [step, setStep] = useState(preselect ? 1 : 0);
  const [source, setSource] = useState<Source>(initialSource);
  const [bookId, setBookId] = useState<string | "new">(preselect?.id ?? (books.some((b) => b.pageCount > 0) ? "" : "new"));
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"shadow_book" | "picture_book">("shadow_book");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [settings, setSettings] = useState<StorySettings>(() =>
    defaultSettings({
      ...(preselectSettings ?? {}),
      source: initialSource,
      age: preselectSettings?.age ?? ageBandFor(currentProfile?.age),
      heroes: preselectSettings?.heroes ?? (currentProfile ? [currentProfile.name] : []),
      chime: preselectSettings?.chime ?? { enabled: initialSource === "book", style: "bell", gapSeconds: 3 },
      review: true,
    }),
  );
  const [customHero, setCustomHero] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof StorySettings>(k: K, v: StorySettings[K]) => setSettings((s) => ({ ...s, [k]: v }));

  const physicalBooks = books.filter((b) => (b.kind === "shadow_book" || b.kind === "picture_book") && b.pageCount > 0);
  const chosenBook = bookId && bookId !== "new" ? books.find((b) => b.id === bookId) : undefined;
  const pageCount =
    source === "book"
      ? chosenBook?.pageCount ?? photos.length
      : source === "wild"
        ? Math.max(photos.length, settings.length === "short" ? 4 : settings.length === "long" ? 9 : 6)
        : settings.length === "short" ? 4 : settings.length === "long" ? 9 : 6;

  const pickSource = (s: Source) => {
    setSource(s);
    setSettings((cur) => ({ ...cur, source: s, chime: { ...cur.chime, enabled: s === "book" } }));
  };

  const sourceReady =
    source === "book"
      ? (bookId && bookId !== "new") || (bookId === "new" && title.trim() && photos.length > 0)
      : source === "wild"
        ? (chosenBook && chosenBook.kind === "wild") || photos.length > 0
        : settings.description.trim().length >= 8;

  const words = useMemo(() => {
    const minutes = source === "book" ? estimateMinutes(settings.length, Math.max(1, pageCount)) : LENGTHS[settings.length].minutes;
    return { minutes, chars: Math.round(minutes * 140 * 6) };
  }, [settings.length, pageCount, source]);

  const toggleHero = (name: string) =>
    set("heroes", settings.heroes.includes(name) ? settings.heroes.filter((h) => h !== name) : [...settings.heroes, name]);

  const conjure = async () => {
    setError(null);
    try {
      let id = chosenBook && (source === "book" || chosenBook.kind === source) ? chosenBook.id : "";
      if (!id) {
        setBusy("Putting the book on the shelf…");
        const form = new FormData();
        const fallbackTitle =
          source === "wild" ? "Our Adventure" : source === "idea" ? settings.description.split(/[.!?\n]/)[0].slice(0, 60) || "A Dreamed-Up Tale" : "My Book";
        form.set("title", title.trim() || fallbackTitle);
        form.set("kind", source === "book" ? kind : source);
        if (settings.description) form.set("notes", settings.description);
        photos.forEach((p) => form.append("pages", p.file, p.file.name));
        id = (await api.form<{ id: string }>("/api/books", form)).id;
      }
      setBusy("Summoning the storyteller…");
      const story = await api.post<{ id: string }>("/api/stories", {
        bookId: id,
        mode: "create",
        settings: { ...settings, source },
        profileId: currentProfile?.id ?? null,
      });
      router.push(`/stories/${story.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The storyteller couldn't start.");
      setBusy(null);
    }
  };

  const STEPS = ["The pictures", "The story", "Voices & sounds", "Conjure"];

  return (
    <>
      <div className="center" style={{ marginBottom: 16 }}>
        <div className="eyebrow">Create a New Story</div>
        <h1>{["What shall we make a story for?", "Shape the story", "Voices & sounds", "Ready to conjure"][step]}</h1>
      </div>
      <nav className="steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <span key={s} className={`step ${i < step ? "done" : ""}`} aria-current={i === step ? "step" : undefined}>
            <i>{i < step ? "✓" : i + 1}</i>
            {s}
          </span>
        ))}
      </nav>

      <div className="parchment stack" style={{ ["--gap" as string]: "26px" }}>
        {step === 0 && (
          <>
            <div className="choices" style={{ ["--min" as string]: "180px" }} role="radiogroup" aria-label="Story source">
              {(
                [
                  ["book", "📖", "A book we own", "Snap each page, and get a brand-new story for the same pictures."],
                  ["wild", "🌿", "Something we saw", "A puddle, a snail, a castle made of sofa cushions…"],
                  ["idea", "💭", "Just an idea", "Describe it, and the storyteller dreams it up."],
                ] as const
              ).map(([value, emoji, label, sub]) => (
                <button key={value} type="button" className="choice" role="radio" aria-checked={source === value} onClick={() => pickSource(value)}>
                  <span className="choice-emoji">{emoji}</span>
                  <span className="choice-title">{label}</span>
                  <span className="choice-sub">{sub}</span>
                </button>
              ))}
            </div>

            {source === "book" && (
              <div className="stack">
                {physicalBooks.length > 0 && (
                  <div>
                    <span className="label">Which book?</span>
                    <div className="choices" style={{ ["--min" as string]: "120px" }}>
                      {physicalBooks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className="choice"
                          aria-pressed={bookId === b.id}
                          onClick={() => setBookId(b.id)}
                          style={{ padding: 10 }}
                        >
                          <div className="story-thumb" style={{ width: 66, height: 88 }}>
                            <Cover id={b.id} title={b.title} kind={b.kind} coverUrl={b.coverUrl} showTitle={false} />
                          </div>
                          <span className="choice-title" style={{ fontSize: "1rem" }}>
                            {b.title}
                          </span>
                          <span className="choice-sub">
                            {b.pageCount} pages · {b.storyCount} stories
                          </span>
                        </button>
                      ))}
                      <button type="button" className="choice" aria-pressed={bookId === "new"} onClick={() => setBookId("new")}>
                        <span className="choice-emoji">＋</span>
                        <span className="choice-title">A new book</span>
                        <span className="choice-sub">Photograph its pages</span>
                      </button>
                    </div>
                  </div>
                )}
                {bookId === "new" && (
                  <>
                    <label className="field">
                      <span>What's the book called?</span>
                      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Goodnight, Forest" />
                    </label>
                    <div>
                      <span className="label">What kind of book is it?</span>
                      <div className="chips">
                        <button type="button" className="chip" aria-pressed={kind === "shadow_book"} onClick={() => setKind("shadow_book")}>
                          🔦 Shadow book
                        </button>
                        <button type="button" className="chip" aria-pressed={kind === "picture_book"} onClick={() => setKind("picture_book")}>
                          📕 Picture book
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="label">The pages, in order</span>
                      <p className="hint" style={{ marginTop: 0 }}>
                        Snap one photo per page. For a shadow book, photograph each picture disc or slide (or its projection on
                        the wall). It's fine if the old words are in the photos: the storyteller will write brand-new ones.
                      </p>
                      <PhotoPicker photos={photos} onChange={setPhotos} />
                    </div>
                  </>
                )}
              </div>
            )}

            {source === "wild" && (
              <div className="stack">
                <label className="field">
                  <span>Name this adventure</span>
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The Great Puddle Expedition" />
                </label>
                <div>
                  <span className="label">Photos from the adventure</span>
                  <PhotoPicker photos={photos} onChange={setPhotos} label="Photo" max={12} />
                </div>
                <label className="field">
                  <span>Tell the storyteller about it (optional)</span>
                  <textarea
                    className="textarea"
                    value={settings.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="We found a snail on the garden wall and Leo named him Professor Slime. He was very slow and very shiny."
                  />
                </label>
              </div>
            )}

            {source === "idea" && (
              <div className="stack">
                <label className="field">
                  <span>What should the story be about?</span>
                  <textarea
                    className="textarea"
                    style={{ minHeight: 130 }}
                    value={settings.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="A dragon who is afraid of the dark, and a firefly who helps him."
                  />
                </label>
                <label className="field">
                  <span>A title (optional)</span>
                  <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="The storyteller will choose one" />
                </label>
              </div>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <span className="label">How long?</span>
              <div className="choices" style={{ ["--min" as string]: "150px" }} role="radiogroup" aria-label="Length">
                {(Object.keys(LENGTHS) as LengthPreset[]).map((l) => (
                  <button key={l} type="button" className="choice" role="radio" aria-checked={settings.length === l} onClick={() => set("length", l)}>
                    <span className="choice-emoji">{l === "short" ? "🌱" : l === "medium" ? "🌳" : "🌲"}</span>
                    <span className="choice-title">{LENGTHS[l].label}</span>
                    <span className="choice-sub">
                      {source === "book" && pageCount ? `About ${estimateMinutes(l, pageCount)} min` : LENGTHS[l].blurb}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">What kind of story?</span>
              <div className="choices" style={{ ["--min" as string]: "130px" }} role="radiogroup" aria-label="Mood">
                {(Object.keys(MOODS) as Mood[]).map((m) => (
                  <button key={m} type="button" className="choice" role="radio" aria-checked={settings.mood === m} onClick={() => set("mood", m)}>
                    <span className="choice-emoji">{MOODS[m].emoji}</span>
                    <span className="choice-title">{MOODS[m].label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Who's listening?</span>
              <div className="chips" role="radiogroup" aria-label="Age">
                {(Object.keys(AGES) as AgeBand[]).map((a) => (
                  <button key={a} type="button" className="chip" aria-pressed={settings.age === a} onClick={() => set("age", a)}>
                    {AGES[a].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="label">Star of the story</span>
              <p className="hint" style={{ marginTop: 0 }}>
                Put a listener right inside the tale. Or leave it to the book's own characters.
              </p>
              <div className="chips">
                {[...new Set([...profiles.map((p) => p.name), ...settings.heroes])].map((name) => {
                  const p = profiles.find((x) => x.name === name);
                  return (
                    <button key={name} type="button" className="chip" aria-pressed={settings.heroes.includes(name)} onClick={() => toggleHero(name)}>
                      {p?.avatar ?? "⭐"} {name}
                    </button>
                  );
                })}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customHero.trim()) set("heroes", [...new Set([...settings.heroes, customHero.trim()])]);
                    setCustomHero("");
                  }}
                  className="row"
                  style={{ gap: 6 }}
                >
                  <input
                    className="input"
                    value={customHero}
                    onChange={(e) => setCustomHero(e.target.value)}
                    placeholder="Add a name (a pet? Grandpa?)"
                    style={{ width: 230, padding: "6px 12px" }}
                  />
                  <button className="chip" type="submit">
                    ＋
                  </button>
                </form>
              </div>
            </div>
            <div>
              <span className="label">A little something to learn (optional)</span>
              <div className="chips">
                {LESSONS.map((l) => (
                  <button key={l} type="button" className="chip" aria-pressed={settings.lesson === l} onClick={() => set("lesson", settings.lesson === l ? "" : l)}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <label className="field">
              <span>Any special wishes?</span>
              <textarea
                className="textarea"
                value={settings.extra}
                onChange={(e) => set("extra", e.target.value)}
                placeholder="Make the moon a character. Include our dog, Biscuit. A joke about socks, please!"
              />
            </label>
            <label className="toggle">
              <input type="checkbox" checked={settings.surprise} onChange={(e) => set("surprise", e.target.checked)} />
              <span>
                <b>Surprise us 🎲</b>
                <span className="muted small">An unexpected twist: a new hero, a new point of view, a different kind of tale.</span>
              </span>
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <span className="label">Who should tell the story?</span>
              <VoicePicker voices={voices} value={settings.narratorVoiceId} onChange={(v) => set("narratorVoiceId", v)} />
            </div>
            <label className="toggle">
              <input type="checkbox" checked={settings.fullCast} onChange={(e) => set("fullCast", e.target.checked)} />
              <span>
                <b>A full cast of voices</b>
                <span className="muted small">
                  Every character gets their own voice: a creaky old owl, a squeaky mouse, a booming giant.
                </span>
              </span>
            </label>
            <ChimePicker value={settings.chime} onChange={(c) => set("chime", c)} />
            <label className="toggle">
              <input type="checkbox" checked={settings.intro} onChange={(e) => set("intro", e.target.checked)} />
              <span>
                <b>A welcome at the start</b>
                <span className="muted small">
                  “Welcome to the Lantern Library… you'll know it's time to turn the page when you hear this sound.”
                </span>
              </span>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={settings.ambience} onChange={(e) => set("ambience", e.target.checked)} />
              <span>
                <b>A soft soundscape underneath</b>
                <span className="muted small">Crickets, rain on the window, waves… whatever suits the story. Very quiet.</span>
              </span>
            </label>
          </>
        )}

        {step === 3 && (
          <>
            <div className="center stack">
              <p style={{ fontSize: "1.15rem" }}>
                A <b>{MOODS[settings.mood].label.toLowerCase()}</b> story,{" "}
                <b>{LENGTHS[settings.length].label.toLowerCase()}</b> (about {words.minutes} minutes)
                {source === "book" ? ` for ${pageCount} pages` : ""}, for <b>{AGES[settings.age].label.toLowerCase()}</b>
                {settings.heroes.length ? (
                  <>
                    , starring <b>{settings.heroes.join(" & ")}</b>
                  </>
                ) : null}
                .
              </p>
              <p className="muted">
                {settings.fullCast ? "A full cast of voices" : "One storyteller"}
                {settings.chime.enabled ? `, a ${settings.chime.style === "bell" ? "bell" : settings.chime.style === "sparkle" ? "sparkle" : "wind chime"} to turn each page` : ""}
                {settings.ambience ? ", and a soft soundscape" : ""}.
              </p>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={settings.review} onChange={(e) => set("review", e.target.checked)} />
              <span>
                <b>Let me read it before the voices record it</b>
                <span className="muted small">
                  Tweak any words, swap voices, then record. Turn off to go straight to listening.
                </span>
              </span>
            </label>
            <p className="faint small center">
              Uses roughly {words.chars.toLocaleString()} voice characters on your ElevenLabs plan.
            </p>
            {error && <p className="notice notice-error">{error}</p>}
            <div className="center">
              <button className="btn btn-lg" onClick={conjure} disabled={Boolean(busy)}>
                {busy ?? "✨ Conjure the story"}
              </button>
            </div>
          </>
        )}

        <div className="spread">
          {step > 0 ? (
            <button className="btn btn-ghost" type="button" onClick={() => setStep(step - 1)} disabled={Boolean(busy)}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < 3 && (
            <button className="btn" type="button" onClick={() => setStep(step + 1)} disabled={step === 0 && !sourceReady}>
              Next →
            </button>
          )}
        </div>
      </div>
    </>
  );
}
