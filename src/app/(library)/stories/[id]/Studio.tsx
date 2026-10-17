"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { Brewing } from "@/components/Brewing";
import { ChimePicker, VoiceSelect, useVoices } from "@/components/Pickers";
import { VoiceDesigner } from "@/components/VoiceDesigner";
import { imageForPage } from "@/lib/shared/pages";
import { formatDuration } from "@/lib/shared/options";
import type { AppStatus, Book, BookPage, ChimeSettings, Story, StoryScript, VoiceOption } from "@/lib/shared/types";

export function Studio({ initial, book, photos, status }: { initial: Story; book: Book; photos: BookPage[]; status: AppStatus }) {
  const api = useApi();
  const router = useRouter();
  const [story, setStory] = useState(initial);
  const [script, setScript] = useState<StoryScript | null>(initial.script);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(initial.status === "draft");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [designing, setDesigning] = useState<{ castId: string } | null>(null);
  const [chime, setChime] = useState<ChimeSettings>(initial.settings.chime);
  const loadedVoices = useVoices();
  const [extraVoices, setExtraVoices] = useState<VoiceOption[]>([]);
  const voices = [...extraVoices, ...(loadedVoices ?? [])];

  const working = story.status === "writing" || story.status === "recording";
  const lastStatus = useRef(initial.status);

  const refresh = useCallback(async () => {
    const res = await api.get<{ story: Story }>(`/api/stories/${story.id}`);
    // The storyteller may have put the book's photos in order: reload them.
    if (lastStatus.current === "writing" && res.story.status !== "writing") router.refresh();
    lastStatus.current = res.story.status;
    setStory(res.story);
    if (res.story.status === "draft" || res.story.status === "ready") {
      setScript((cur) => (dirty && cur ? cur : res.story.script));
      if (res.story.status === "draft") setEditing(true);
    }
    return res.story;
  }, [api, story.id, dirty, router]);

  useEffect(() => {
    if (!working) return;
    const t = setInterval(() => void refresh().catch(() => undefined), 1500);
    return () => clearInterval(t);
  }, [working, refresh]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!script) return;
    const res = await api.patch<{ story: Story }>(`/api/stories/${story.id}`, { title: script.title, script });
    setStory(res.story);
    setScript(res.story.script);
    setDirty(false);
  };

  const record = () =>
    run(async () => {
      if (dirty) await saveDraft();
      await api.post(`/api/stories/${story.id}/record`);
      setEditing(false);
      await refresh();
    });

  const rewrite = () =>
    run(async () => {
      if (story.script && !confirm("Write a completely different story? This draft will be replaced.")) return;
      await api.post(`/api/stories/${story.id}/rewrite`);
      setDirty(false);
      await refresh();
    });

  const retry = () =>
    run(async () => {
      await api.post(`/api/stories/${story.id}/rewrite`);
      await refresh();
    });

  const remix = () =>
    run(async () => {
      const res = await api.post<{ story: Story }>(`/api/stories/${story.id}/remix`, { chime });
      setStory(res.story);
    });

  const remove = () =>
    run(async () => {
      if (!confirm("Delete this story for good?")) return;
      await api.del(`/api/stories/${story.id}`);
      router.push(`/books/${book.id}`);
      router.refresh();
    });

  const updateScript = (fn: (s: StoryScript) => StoryScript) => {
    setScript((s) => (s ? fn(structuredClone(s)) : s));
    setDirty(true);
  };

  // ------------------------------------------------------------------ views

  if (story.status === "writing") {
    return (
      <Brewing
        title={story.mode === "read" ? "Preparing the reading" : "The storyteller is at work"}
        progress={story.progress}
        note="You can leave this page. The story keeps brewing and will be waiting on the shelf."
      />
    );
  }
  if (story.status === "recording") {
    return (
      <Brewing
        title="The voices are recording"
        progress={story.progress}
        note="Each character is stepping up to the microphone. This takes a minute or two."
      />
    );
  }

  const chars = script ? script.pages.reduce((n, p) => n + p.lines.reduce((m, l) => m + l.text.length, 0), 0) : 0;
  const castName = (id: string) => script?.cast.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="stack" style={{ ["--gap" as string]: "22px" }}>
      <div className="center">
        <div className="eyebrow">
          <Link href={`/books/${book.id}`}>{book.title}</Link>
          {story.mode === "read" ? " · read aloud" : ""}
        </div>
        <h1>{script?.title ?? story.title}</h1>
        {story.synopsis && <p className="muted">{story.synopsis}</p>}
      </div>

      {story.status === "error" && (
        <div className="notice notice-error center">
          <p>{story.error ?? "Something went wrong."}</p>
          <button className="btn" onClick={retry} disabled={busy}>
            Try again
          </button>
        </div>
      )}

      {story.status === "ready" && story.audioUrl && (
        <div className="panel center stack">
          <div className="row" style={{ justifyContent: "center" }}>
            <Link href={`/play/${story.id}`} className="btn btn-lg">
              ▶ Listen now
            </Link>
          </div>
          <p className="faint small">
            {formatDuration(story.duration)} ·{" "}
            <a href={`${story.audioUrl.split("?")[0]}?download=${encodeURIComponent((script?.title ?? "story") + ".mp3")}`}>
              Download the MP3
            </a>{" "}
            for a speaker, the car, or a make-your-own Yoto card.
          </p>
          <details style={{ textAlign: "left" }}>
            <summary style={{ cursor: "pointer" }} className="muted">
              Change the page-turn chime
            </summary>
            <div style={{ marginTop: 14 }} className="parchment">
              <ChimePicker value={chime} onChange={setChime} />
              <div className="center" style={{ marginTop: 14 }}>
                <button className="btn btn-sm" onClick={remix} disabled={busy}>
                  {busy ? "Re-binding…" : "Re-bind the story (no new recording)"}
                </button>
              </div>
            </div>
          </details>
        </div>
      )}

      {error && <p className="notice notice-error">{error}</p>}

      {script && (
        <div className="parchment stack" style={{ ["--gap" as string]: "22px" }}>
          <div className="spread">
            <h2 style={{ margin: 0 }}>{editing ? "Read it over" : "The script"}</h2>
            {!editing && (
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
                ✎ Edit & re-record
              </button>
            )}
          </div>

          {editing && (
            <label className="field">
              <span>Title</span>
              <input className="input" value={script.title} onChange={(e) => updateScript((s) => ({ ...s, title: e.target.value }))} />
            </label>
          )}

          <section>
            <h3>The cast</h3>
            <div className="cast-grid">
              {script.cast.map((c, ci) => (
                <div className="cast-card" key={c.id}>
                  <div className="cast-name">{c.name}</div>
                  {c.description && <div className="small muted">{c.description}</div>}
                  {c.voiceBrief && <div className="small tag">“{c.voiceBrief}”</div>}
                  {editing ? (
                    <div style={{ marginTop: 8 }} className="stack" >
                      {voices.length > 0 && (
                        <VoiceSelect
                          voices={voices}
                          value={c.voiceId}
                          onChange={(v) => updateScript((s) => ((s.cast[ci].voiceId = v), s))}
                        />
                      )}
                      {status.voices && (
                        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setDesigning({ castId: c.id })}>
                          🪄 Conjure a new voice
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="small faint" style={{ marginTop: 6 }}>
                      🎙️ {voices.find((v) => v.voiceId === c.voiceId)?.persona?.name ?? voices.find((v) => v.voiceId === c.voiceId)?.name ?? "A storyteller"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3>The pages</h3>
            {script.pages.map((p, pi) => {
              const img = imageForPage(p.page, photos, story.settings.source, script.pages.length);
              return (
                <div className="script-page" key={p.page} style={img ? undefined : { gridTemplateColumns: "1fr" }}>
                  {img && (
                    <div className="script-pic">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`Page ${p.page}`} loading="lazy" />
                    </div>
                  )}
                  <div>
                    <div className="eyebrow">
                      Page {p.page}
                      {p.picture ? <span className="faint small"> · {p.picture}</span> : null}
                    </div>
                    {p.lines.length === 0 && <p className="faint small">(No words on this page, just the chime.)</p>}
                    {p.lines.map((l, li) =>
                      editing ? (
                        <div className="line" key={li}>
                          <select
                            className="select speaker"
                            value={l.speaker}
                            onChange={(e) => updateScript((s) => ((s.pages[pi].lines[li].speaker = e.target.value), s))}
                            aria-label="Speaker"
                            style={{ padding: "6px 8px" }}
                          >
                            {script.cast.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", gap: 6 }}>
                            <textarea
                              className="textarea"
                              value={l.text}
                              rows={Math.max(2, Math.ceil(l.text.length / 40))}
                              onChange={(e) => updateScript((s) => ((s.pages[pi].lines[li].text = e.target.value), s))}
                              aria-label={`Page ${p.page}, line ${li + 1}`}
                            />
                            <button
                              type="button"
                              className="btn-quiet btn btn-sm"
                              aria-label="Remove line"
                              onClick={() => updateScript((s) => (s.pages[pi].lines.splice(li, 1), s))}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="line-read" key={li}>
                          {script.cast.length > 1 && <b>{castName(l.speaker)}:</b>}
                          {l.text.split(/(\[[^\]]+\])/).map((part, k) =>
                            /^\[.*\]$/.test(part) ? (
                              <span className="tag" key={k}>
                                {part.slice(1, -1)}{" "}
                              </span>
                            ) : (
                              <span key={k}>{part}</span>
                            ),
                          )}
                        </p>
                      ),
                    )}
                    {editing && (
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => updateScript((s) => (s.pages[pi].lines.push({ speaker: "narrator", text: "" }), s))}
                      >
                        ＋ Add a line
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>

          {editing && (
            <div className="stack center">
              <p className="faint small">
                Tip: words in [brackets] tell the voices how to say a line, like [whispers] or [giggles]. About{" "}
                {chars.toLocaleString()} voice characters. Only pages you change are re-recorded.
              </p>
              <div className="row" style={{ justifyContent: "center" }}>
                {dirty && (
                  <button className="btn btn-ghost" onClick={() => run(saveDraft)} disabled={busy}>
                    Save changes
                  </button>
                )}
                {story.mode === "create" && (
                  <button className="btn btn-ghost" onClick={rewrite} disabled={busy}>
                    🎲 Write a different story
                  </button>
                )}
                <button className="btn btn-lg btn-velvet" onClick={record} disabled={busy || !status.voices && !status.demoMode}>
                  🎙️ {story.status === "ready" ? "Re-record" : "Record the story"}
                </button>
              </div>
              {!status.voices && !status.demoMode && (
                <p className="notice small">Recording needs an ElevenLabs API key. <Link href="/grownups">Set it up</Link>.</p>
              )}
            </div>
          )}
        </div>
      )}

      {!working && (
        <p className="center">
          <button className="btn btn-quiet btn-sm" onClick={remove} disabled={busy} style={{ color: "var(--danger)" }}>
            Delete this story
          </button>
        </p>
      )}

      {designing && script && (
        <VoiceDesigner
          initialName={script.cast.find((c) => c.id === designing.castId)?.name}
          initialDescription={(() => {
            const c = script.cast.find((x) => x.id === designing.castId);
            return [c?.voiceBrief, c?.description].filter(Boolean).join(". ");
          })()}
          onClose={() => setDesigning(null)}
          onSaved={(v) => {
            setExtraVoices((cur) => [
              { voiceId: v.voiceId, name: v.name, description: v.description, gender: null, age: null, accent: null, previewUrl: null, persona: null, source: "designed" },
              ...cur,
            ]);
            updateScript((s) => {
              const c = s.cast.find((x) => x.id === designing.castId);
              if (c) c.voiceId = v.voiceId;
              return s;
            });
            setDesigning(null);
          }}
        />
      )}
    </div>
  );
}
