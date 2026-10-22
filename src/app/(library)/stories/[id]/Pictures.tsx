"use client";

import { useState } from "react";
import { useApi } from "@/components/Grownup";
import { PurchaseDialog, type PurchaseOffer } from "@/components/Purchase";
import { shrinkImage } from "@/lib/client/images";
import { StylePicker, bookEstimate } from "@/components/PictureBook";
import { ART_STYLES, DEFAULT_ART_STYLE, SKETCHES, bookPictures, formatMoney, isStandIn } from "@/lib/shared/art";
import type { AppStatus, ArtCharacter, ArtStyle, Story } from "@/lib/shared/types";

// A story's pictures, in the studio: meet the characters as sketches and
// choose the right ones, then draw the book. Everything that costs money
// shows its price first and asks a grown-up for the family PIN.

/** A purchase of pictures, for the dialog: the price comes from the app's status, and is free while the pictures are stand-ins. */
function useOffers(story: Story, status: AppStatus, onStory: (s: Story) => void) {
  const api = useApi();
  const [offer, setOffer] = useState<PurchaseOffer | null>(null);
  const offerPictures = (what: string, pictures: number, url: string, body: object) =>
    setOffer({
      what,
      pictures,
      each: status.picturePrice,
      real: status.illustrator,
      buy: async (approval) => onStory((await api.post<{ story: Story }>(url, { ...body, approval })).story),
    });
  const dialog = offer && <PurchaseDialog offer={offer} onDone={() => setOffer(null)} />;
  return { offerPictures, dialog };
}

export function Pictures({
  story,
  status,
  spent,
  planPrice,
  heroes,
  onStory,
}: {
  story: Story;
  status: AppStatus;
  /** What this story's pictures have cost so far. */
  spent: number;
  /** About what planning the pictures costs (storyteller time). */
  planPrice: number;
  heroes: string[];
  onStory: (s: Story) => void;
}) {
  const api = useApi();
  const art = story.art;
  const [style, setStyle] = useState<ArtStyle>(art?.style ?? story.settings.artStyle ?? DEFAULT_ART_STYLE);
  const [looks, setLooks] = useState<Record<string, string>>({});
  const [skipSketches, setSkipSketches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { offerPictures, dialog } = useOffers(story, status, onStory);
  const each = status.picturePrice;
  const pages = story.script?.pages.length ?? 0;
  const working = Boolean(art && art.status !== "idle");

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const plan = (again: boolean) =>
    run(async () => {
      if (again && !confirm("Start the pictures over? The characters and pictures so far will be set aside.")) return;
      onStory((await api.post<{ story: Story }>(`/api/stories/${story.id}/art`, { style })).story);
    });

  // ------------------------------------------------------------ not yet a picture book
  if (!art) {
    return (
      <div className="parchment stack pictures">
        <h2 style={{ margin: 0 }}>📖 Make it a picture book</h2>
        <p className="muted" style={{ margin: 0 }}>
          The illustrator draws a cover and a picture for every page. First you&apos;ll meet the main characters as sketches, and choose how they
          look together.
        </p>
        <StylePicker value={style} onChange={setStyle} />
        {error && <p className="notice notice-error">{error}</p>}
        <div>
          <button className="btn" onClick={() => plan(false)} disabled={busy}>
            {busy ? "Opening the sketchbook…" : "✨ Plan the pictures"}
          </button>
        </div>
        <p className="small purchase-terms" style={{ margin: 0 }}>
          Planning is storyteller time, about {formatMoney(planPrice)}. Drawing the book comes after, about {formatMoney(bookEstimate(pages, each))}
          {status.illustrator ? "" : " once the illustrator is set up (stand-in pictures are free until then)"}, and asks a grown-up first.
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------ planning
  if (art.status === "planning" || !art.scenes.length) {
    return (
      <div className="parchment stack pictures">
        <h2 style={{ margin: 0 }}>📖 The pictures</h2>
        {art.status === "planning" ? (
          <p className="muted" style={{ margin: 0 }}>
            ✏️ The illustrator is reading the story and planning the pictures…
          </p>
        ) : (
          <>
            {art.error && <p className="notice notice-error">{art.error}</p>}
            <div>
              <button className="btn" onClick={() => plan(false)} disabled={busy}>
                ✨ Plan the pictures again
              </button>
            </div>
            <p className="small purchase-terms" style={{ margin: 0 }}>
              Planning is storyteller time, about {formatMoney(planPrice)}.
            </p>
          </>
        )}
      </div>
    );
  }

  const mains = art.characters.filter((c) => c.main);
  const others = art.characters.filter((c) => !c.main);
  const unchosen = mains.filter((c) => c.chosen === null);
  const todo = (art.cover ? 0 : 1) + art.pages.filter((p) => !p).length;
  const drawn = bookPictures(art.pages.length) - todo;
  const standIns = [art.cover, ...art.pages].some((p) => isStandIn(p)) || art.characters.some((c) => c.sketches.some(isStandIn));

  const saveLook = async (c: ArtCharacter) => {
    const look = looks[c.id];
    if (look === undefined || look === c.look) return;
    onStory((await api.patch<{ story: Story }>(`/api/stories/${story.id}/art`, { looks: { [c.id]: look } })).story);
  };

  const sketch = (c: ArtCharacter) =>
    run(async () => {
      await saveLook(c);
      offerPictures(`${c.sketches.length ? "More sketches of" : "Sketches of"} ${c.name} (${SKETCHES} tries)`, SKETCHES, `/api/stories/${story.id}/art/sketch`, {
        characterId: c.id,
      });
    });

  const choose = (c: ArtCharacter, index: number) =>
    run(async () => onStory((await api.patch<{ story: Story }>(`/api/stories/${story.id}/art`, { choose: { characterId: c.id, index } })).story));

  const addDrawing = (c: ArtCharacter, file: File | undefined) =>
    run(async () => {
      if (!file) return;
      const form = new FormData();
      form.set("characterId", c.id);
      form.set("picture", await shrinkImage(file));
      onStory((await api.form<{ story: Story }>(`/api/stories/${story.id}/art/drawing`, form)).story);
    });

  const changeStyle = (s: ArtStyle) =>
    run(async () => {
      setStyle(s);
      onStory((await api.patch<{ story: Story }>(`/api/stories/${story.id}/art`, { style: s })).story);
    });

  const drawBook = () =>
    offerPictures(
      drawn === 0 ? `The cover and ${art.pages.length} pages of “${story.title}”` : `The ${todo} ${todo === 1 ? "picture" : "pictures"} still to draw`,
      todo,
      `/api/stories/${story.id}/art/draw`,
      {},
    );

  const isHero = (c: ArtCharacter) => heroes.some((h) => h.toLowerCase() === c.name.toLowerCase());

  return (
    <div className="parchment stack pictures" style={{ ["--gap" as string]: "20px" }}>
      <div className="spread">
        <h2 style={{ margin: 0 }}>📖 The pictures</h2>
        <span className="small muted">
          {ART_STYLES[art.style].emoji} {ART_STYLES[art.style].label}
        </span>
      </div>
      {error && <p className="notice notice-error">{error}</p>}
      {art.error && !working && <p className="notice notice-error">{art.error}</p>}
      {working && art.progress && (
        <div className="art-progress" role="status">
          <div className="credit-meter" aria-hidden="true">
            <span style={{ width: `${Math.round((art.progress.done / Math.max(1, art.progress.total)) * 100)}%` }} />
          </div>
          <div className="small">
            ✏️ {art.progress.step}
            {art.progress.total > 1 ? ` (${art.progress.done} of ${art.progress.total})` : "…"}
          </div>
        </div>
      )}

      <section className="stack" style={{ ["--gap" as string]: "12px" }}>
        <h3 style={{ margin: 0 }}>Meet the characters</h3>
        <p className="small muted" style={{ margin: 0 }}>
          Sketch each one and choose the right one together. Every page is drawn from the sketch you choose, so they look the same all the way
          through.
        </p>
        {mains.map((c) => (
          <div className="cast-card art-character" key={c.id}>
            <div className="cast-name">{c.name}</div>
            <label className="field" style={{ marginTop: 6 }}>
              <span className="small">What {c.name} looks like</span>
              <textarea
                className="textarea"
                rows={2}
                value={looks[c.id] ?? c.look}
                onChange={(e) => setLooks((l) => ({ ...l, [c.id]: e.target.value }))}
                onBlur={() => void saveLook(c).catch((err) => setError(err instanceof Error ? err.message : "That didn't save."))}
                placeholder={
                  isHero(c) ? `Describe ${c.name} in words: curly brown hair, freckles, a brand-new gap in a big smile…` : `Big, small, what colors, what they wear…`
                }
              />
            </label>
            {isHero(c) && <p className="small faint" style={{ margin: "4px 0 0" }}>Described in words, so photos of your children are never sent anywhere.</p>}
            {(c.sketches.length > 0 || c.drawing) && (
              <div className="sketches" role="radiogroup" aria-label={`Sketches of ${c.name}`}>
                {c.drawing && (
                  <figure className="sketch drawing">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.drawing} alt={`A drawing of ${c.name}`} />
                    <figcaption>Our drawing</figcaption>
                  </figure>
                )}
                {c.sketches.map((url, i) => (
                  <button
                    key={url}
                    type="button"
                    className="sketch"
                    role="radio"
                    aria-checked={c.chosen === i}
                    aria-label={`Sketch ${i + 1}`}
                    onClick={() => choose(c, i)}
                    disabled={busy}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
            {c.sketches.length > 0 && c.chosen === null && <p className="small" style={{ margin: "6px 0 0" }}>Which one is {c.name}? Tap to choose.</p>}
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn btn-sm" onClick={() => sketch(c)} disabled={busy || working}>
                ✏️ {c.sketches.length ? "Sketch again" : `Sketch ${c.name}`} · {status.illustrator ? formatMoney(each * SKETCHES) : "free"}
              </button>
              <label className={`btn btn-ghost btn-sm ${busy || working ? "disabled" : ""}`}>
                📷 {c.drawing ? "A different drawing" : "Use our own drawing"}
                <input type="file" accept="image/*" hidden disabled={busy || working} onChange={(e) => addDrawing(c, e.target.files?.[0])} />
              </label>
            </div>
            {c.drawing && !c.sketches.length && (
              <p className="small faint" style={{ margin: "6px 0 0" }}>
                The sketches will be made from the drawing, keeping its colors, shapes and funny details.
              </p>
            )}
          </div>
        ))}
        {others.length > 0 && (
          <details className="art-others">
            <summary className="small">
              Also in the pictures: {others.map((c) => c.name).join(", ")} (drawn from their descriptions)
            </summary>
            <div className="stack" style={{ ["--gap" as string]: "8px", marginTop: 10 }}>
              {others.map((c) => (
                <label className="field" key={c.id}>
                  <span className="small">{c.name}</span>
                  <textarea
                    className="textarea"
                    rows={2}
                    value={looks[c.id] ?? c.look}
                    onChange={(e) => setLooks((l) => ({ ...l, [c.id]: e.target.value }))}
                    onBlur={() => void saveLook(c).catch((err) => setError(err instanceof Error ? err.message : "That didn't save."))}
                  />
                </label>
              ))}
            </div>
          </details>
        )}
      </section>

      <section className="stack" style={{ ["--gap" as string]: "12px" }}>
        <h3 style={{ margin: 0 }}>The book</h3>
        <div className="art-cover-row">
          <PagePicture story={story} status={status} page={0} onStory={onStory} />
          <div className="stack" style={{ ["--gap" as string]: "8px" }}>
            <div className="small">
              {drawn === 0 ? `A cover and ${art.pages.length} pages to draw.` : `${drawn} of ${bookPictures(art.pages.length)} pictures drawn.`}
            </div>
            {drawn === 0 && (
              <div>
                <span className="small muted">Style: </span>
                {(Object.keys(ART_STYLES) as ArtStyle[]).map((s) => (
                  <button key={s} type="button" className="chip" aria-pressed={art.style === s} onClick={() => changeStyle(s)} disabled={busy || working}>
                    {ART_STYLES[s].emoji} {ART_STYLES[s].label}
                  </button>
                ))}
              </div>
            )}
            {todo > 0 && (
              <div>
                <button className="btn" onClick={drawBook} disabled={busy || working || (unchosen.length > 0 && !skipSketches)}>
                  🎨 {drawn === 0 ? "Draw the book" : `Draw the ${todo} still to do`} · {status.illustrator ? formatMoney(each * todo) : "free"}
                </button>
              </div>
            )}
            {todo > 0 && unchosen.length > 0 && !skipSketches && (
              <p className="small" style={{ margin: 0 }}>
                First choose a sketch for {unchosen.map((c) => c.name).join(" and ")}, so they look the same on every page.{" "}
                <button type="button" className="link-button" onClick={() => setSkipSketches(true)}>
                  Or draw without sketches
                </button>
              </p>
            )}
            {todo === 0 && <p className="small muted" style={{ margin: 0 }}>Every picture is drawn. Tap ↻ beside a page to redraw it.</p>}
            <p className="small purchase-terms" style={{ margin: 0 }}>
              {status.illustrator
                ? `Pictures for this story so far: ${formatMoney(spent, "nothing yet")}.`
                : standIns
                  ? "Stand-in pictures, free, while the illustrator isn't set up."
                  : `Stand-in pictures are free until the illustrator is set up; then about ${formatMoney(each)} a picture.`}
            </p>
          </div>
        </div>
      </section>
      {dialog}
    </div>
  );
}

/** The cover (page 0), or a page beside its words in the studio: its picture (or what it will show), and a redraw. */
export function PagePicture({ story, status, page, onStory }: { story: Story; status: AppStatus; page: number; onStory: (s: Story) => void }) {
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const { offerPictures, dialog } = useOffers(story, status, (s) => {
    setAsking(false);
    setNote("");
    onStory(s);
  });
  const art = story.art!;
  const cover = page === 0;
  const url = cover ? art.cover : art.pages[page - 1];
  const scene = cover ? art.coverScene : (art.scenes.find((s) => s.page === page)?.scene ?? "");
  const working = art.status !== "idle";
  return (
    <div className={`script-pic page-picture ${cover ? "art-cover" : ""}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={cover ? `The cover of ${story.title}` : `Page ${page}`} loading="lazy" />
      ) : (
        <div className="picture-to-be small">
          <b>{cover ? "The cover, to be drawn" : "To be drawn"}</b>
          <span>{scene}</span>
        </div>
      )}
      {url && !asking && (
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAsking(true)} disabled={working}>
          ↻ Redraw
        </button>
      )}
      {asking && (
        <div className="stack" style={{ ["--gap" as string]: "6px", marginTop: 6 }}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change? (optional)" aria-label="What should change" />
          <div className="row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => offerPictures(cover ? "Redraw the cover" : `Redraw page ${page}`, 1, `/api/stories/${story.id}/art/draw`, { pages: [page], note })}
              disabled={working}
            >
              ↻ Redraw · {status.illustrator ? formatMoney(status.picturePrice) : "free"}
            </button>
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
