"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { Spinner, WaitLine } from "@/components/Waiting";
import { clock, prepareRecording } from "@/lib/client/audio";
import { keepAwake, sendTrouble, sentWords, upload } from "@/lib/client/upload";
import { familyVoiceSeconds } from "@/lib/shared/options";
import type { FamilyVoice, Keepsake } from "@/lib/shared/types";

// A family's voices, kept: a voicemail from Grandma, a child reading at four,
// a bedtime song. A grown-up's recordings can also become a storytelling voice.

export function FamilyVoices({
  keepsakes,
  familyVoices,
  canMakeVoices,
}: {
  keepsakes: Keepsake[];
  familyVoices: FamilyVoice[];
  canMakeVoices: boolean;
}) {
  const api = useApi();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [making, setMaking] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const people = [...new Set(keepsakes.map((k) => k.person))];
  const voiceFor = (person: string) => familyVoices.find((v) => v.person === person);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  };

  return (
    <div className="stack">
      <p className="muted" style={{ margin: 0 }}>
        Keep the voices you love, just as they are: a voicemail from Grandma, your children reading at four, a song at bedtime.
        A grown-up&apos;s recordings can also become a storytelling voice, so they can read any book, poem or letter aloud.
        Recordings stay private to your family.
      </p>
      {!adding && (
        <div>
          <button className="btn btn-sm" onClick={() => setAdding(true)}>
            ＋ Add a recording
          </button>
        </div>
      )}

      {adding && (
        <KeepsakeAdder
          people={people}
          onClose={() => setAdding(false)}
          onSaved={(person) => {
            setAdding(false);
            setMsg(`Saved to ${person}'s recordings.`);
            router.refresh();
          }}
        />
      )}
      {msg && <p className="notice small">{msg}</p>}
      {error && <p className="notice notice-error small">{error}</p>}

      {people.length === 0 && !adding && <p className="faint small">No recordings yet.</p>}

      {people.map((person) => {
        const mine = keepsakes.filter((k) => k.person === person);
        const voice = voiceFor(person);
        return (
          <div key={person} className="keepsake-person">
            <div className="spread">
              <h3>{person}</h3>
              {voice ? (
                <span className="keepsake-voice">💛 Reads stories as “{voice.name}”</span>
              ) : (
                making !== person && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setMaking(person)}>
                    📖 Let {person} read stories
                  </button>
                )
              )}
            </div>
            <ul className="keepsake-list">
              {mine.map((k) => (
                <KeepsakeRow
                  key={k.id}
                  keepsake={k}
                  onRemove={() => act(() => api.del(`/api/keepsakes/${k.id}`), "Recording removed.")}
                />
              ))}
            </ul>
            {voice && (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => act(() => api.del(`/api/family-voices/${encodeURIComponent(voice.voiceId)}`), `${voice.name} won't read stories any more. The recordings are still here.`)}
                >
                  Stop using {voice.name}&apos;s storytelling voice
                </button>
              </div>
            )}
            {making === person && (
              <VoiceMaker
                person={person}
                keepsakes={mine}
                enabled={canMakeVoices}
                onClose={() => setMaking(null)}
                onMade={(name) => {
                  setMaking(null);
                  setMsg(`${name} can read to you now: find them first in Read to Me, or pick them as the storyteller when you make a story.`);
                  router.refresh();
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function KeepsakeRow({ keepsake: k, onRemove }: { keepsake: Keepsake; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="keepsake">
      <div className="keepsake-meta">
        <b>{k.title}</b>
        <span className="small faint">
          {[k.recordedOn, clock(k.durationMs)].filter(Boolean).join(" · ")}
        </span>
      </div>
      <audio controls preload="none" src={k.audioUrl} />
      {confirming ? (
        <span className="row" style={{ gap: 6 }}>
          <button className="btn btn-sm btn-velvet" onClick={onRemove}>
            Remove for good
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </span>
      ) : (
        <button className="btn btn-quiet btn-sm" aria-label={`Remove ${k.title}`} onClick={() => setConfirming(true)}>
          Remove
        </button>
      )}
    </li>
  );
}

const PASSAGE = `The Owl and the Pussy-cat went to sea
In a beautiful pea-green boat,
They took some honey, and plenty of money,
Wrapped up in a five-pound note.
The Owl looked up to the stars above,
And sang to a small guitar,
"O lovely Pussy! O Pussy, my love,
What a beautiful Pussy you are,
You are, you are!
What a beautiful Pussy you are!"

Pussy said to the Owl, "You elegant fowl!
How charmingly sweet you sing!
O let us be married! too long we have tarried:
But what shall we do for a ring?"
They sailed away, for a year and a day,
To the land where the Bong-tree grows,
And there in a wood a Piggy-wig stood
With a ring at the end of his nose,
His nose, his nose,
With a ring at the end of his nose.`;

function KeepsakeAdder({ people, onClose, onSaved }: { people: string[]; onClose: () => void; onSaved: (person: string) => void }) {
  const api = useApi();
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [person, setPerson] = useState("");
  const [title, setTitle] = useState("");
  const [recordedOn, setRecordedOn] = useState("");
  const [ready, setReady] = useState<{ file: File; durationMs: number; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ started: number; recorder: MediaRecorder } | null>(null);
  const [now, setNow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [recording]);
  useEffect(() => () => recording?.recorder.stream.getTracks().forEach((t) => t.stop()), [recording]);

  const prepare = async (blob: Blob, name: string) => {
    setError(null);
    setBusy("Getting the recording ready…");
    try {
      const out = await prepareRecording(blob, name, (f) => setBusy(`Getting the recording ready (${Math.round(f * 100)}%)…`));
      setReady((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { ...out, url: URL.createObjectURL(out.file) };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That recording couldn't be opened.");
    } finally {
      setBusy(null);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void prepare(new Blob(chunks, { type: recorder.mimeType }), title || person || "recording");
      };
      recorder.start(1000);
      setReady(null);
      setNow(Date.now());
      setRecording({ started: Date.now(), recorder });
    } catch {
      setError("The microphone isn't available. Allow microphone access for this site, or upload a recording instead.");
    }
  };
  const stopRecording = () => {
    recording?.recorder.stop();
    setRecording(null);
  };

  const save = async () => {
    if (!ready || !person.trim()) return;
    setBusy("Saving the recording…");
    setError(null);
    // A long recording can take a while to send on a weak signal: the screen stays on until it's in.
    const release = await keepAwake();
    try {
      const form = new FormData();
      form.set("audio", ready.file);
      form.set("person", person.trim());
      form.set("title", title.trim() || (mode === "record" ? "Recorded here" : "A recording"));
      form.set("recordedOn", recordedOn.trim());
      form.set("durationMs", String(ready.durationMs));
      await upload(api, "/api/keepsakes", form, (n, of) => setBusy(`${sentWords("Saving the recording", n, of)}…`));
      URL.revokeObjectURL(ready.url);
      onSaved(person.trim());
    } catch (err) {
      setError(sendTrouble(err, "That recording couldn't be saved."));
      setBusy(null);
    } finally {
      release();
    }
  };

  return (
    <div className="keepsake-box stack">
      <label className="field">
        <span>Whose voice is it?</span>
        <input className="input" list="keepsake-people" value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Grandma June" maxLength={40} />
        <datalist id="keepsake-people">
          {people.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
      </label>
      <div className="row keepsake-fields">
        <label className="field" style={{ flex: "2 1 220px" }}>
          <span>What is it?</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Birthday voicemail" maxLength={80} />
        </label>
        <label className="field" style={{ flex: "1 1 140px" }}>
          <span>When (optional)</span>
          <input className="input" value={recordedOn} onChange={(e) => setRecordedOn(e.target.value)} placeholder="Spring 2021" maxLength={40} />
        </label>
      </div>

      <div className="chips" role="tablist" aria-label="How to add it">
        <button type="button" role="tab" className="chip" aria-selected={mode === "upload"} aria-pressed={mode === "upload"} onClick={() => setMode("upload")} disabled={!!recording}>
          📁 Upload a recording
        </button>
        <button type="button" role="tab" className="chip" aria-selected={mode === "record"} aria-pressed={mode === "record"} onClick={() => setMode("record")} disabled={!!recording}>
          🎙️ Record now
        </button>
      </div>

      {mode === "upload" ? (
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <div>
            <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              Choose a recording
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="audio/*,video/*,.m4a,.mp3,.wav,.aac,.caf,.mp4,.mov"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void prepare(f, f.name.replace(/\.\w+$/, ""));
              }}
            />
          </div>
          <p className="hint" style={{ margin: 0 }}>
            A voicemail on an iPhone: open it in the Phone app, tap the share button, and choose <i>Save to Files</i>, then pick it
            here. On Android, share or save the message as an audio file. Voice memos and videos work too; from a video we keep
            just the sound.
          </p>
        </div>
      ) : (
        <div className="stack" style={{ ["--gap" as string]: "8px" }}>
          <details className="passage">
            <summary>Making a storytelling voice? Read this aloud for a minute or two</summary>
            <pre>{PASSAGE}</pre>
            <p className="small faint">“The Owl and the Pussy-cat” by Edward Lear. Read it the way you would at bedtime, in a quiet room.</p>
          </details>
          <div className="row">
            {recording ? (
              <button className="btn btn-sm btn-velvet" onClick={stopRecording}>
                ■ Stop · {clock(now - recording.started)}
              </button>
            ) : (
              <button className="btn btn-sm" onClick={startRecording} disabled={!!busy}>
                ● {ready ? "Record again" : "Start recording"}
              </button>
            )}
            {recording && <span className="rec-dot" aria-label="Recording" />}
          </div>
        </div>
      )}

      {busy && (
        <div className="wait-line" role="status" aria-live="polite">
          <Spinner />
          <div>
            <b>{busy}</b>
          </div>
        </div>
      )}
      {ready && !busy && (
        <div className="stack" style={{ ["--gap" as string]: "6px" }}>
          <span className="small muted">Ready to keep · {clock(ready.durationMs)}</span>
          <audio controls src={ready.url} />
        </div>
      )}
      {error && <p className="notice notice-error small">{error}</p>}

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={!!recording}>
          Cancel
        </button>
        <button className="btn btn-sm" onClick={save} disabled={!ready || !person.trim() || !!busy || !!recording}>
          Keep this recording
        </button>
      </div>
    </div>
  );
}

function VoiceMaker({
  person,
  keepsakes,
  enabled,
  onClose,
  onMade,
}: {
  person: string;
  keepsakes: Keepsake[];
  enabled: boolean;
  onClose: () => void;
  onMade: (name: string) => void;
}) {
  const api = useApi();
  const [chosen, setChosen] = useState<string[]>(keepsakes.map((k) => k.id));
  const [name, setName] = useState(person);
  const [adult, setAdult] = useState(false);
  const [consent, setConsent] = useState(false);
  const [cleanNoise, setCleanNoise] = useState(true);
  // When learning the voice began, and about how long it takes.
  const [busy, setBusy] = useState<{ startedAt: number; seconds: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalMs = keepsakes.filter((k) => chosen.includes(k.id)).reduce((n, k) => n + k.durationMs, 0);
  const quality =
    totalMs < 10_000
      ? "Not quite enough yet: we need at least 10 seconds of their voice."
      : totalMs < 45_000
        ? "That's enough to try, though the voice may sound a little rough. More recordings of them will help."
        : totalMs < 90_000
          ? "A good amount. The voice should sound like them."
          : "Plenty to learn from.";

  const make = async () => {
    setBusy({ startedAt: Date.now(), seconds: familyVoiceSeconds(totalMs, cleanNoise) });
    setError(null);
    try {
      const res = await api.post<{ name: string }>("/api/family-voices", { name, keepsakeIds: chosen, adult, consent, cleanNoise });
      onMade(res.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That voice couldn't be made.");
      setBusy(null);
    }
  };

  return (
    <div className="keepsake-box stack">
      <b>Teach the storytellers {person}&apos;s voice</b>
      <p className="small muted" style={{ margin: 0 }}>
        From these recordings, {person} can read any book, poem or letter aloud, in their own voice. Only a grown-up&apos;s voice
        can become a storyteller; children&apos;s recordings stay as keepsakes, exactly as they are.
      </p>
      <div className="stack" style={{ ["--gap" as string]: "4px" }}>
        {keepsakes.map((k) => (
          <label key={k.id} className="row small" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={chosen.includes(k.id)}
              onChange={(e) => setChosen((c) => (e.target.checked ? [...c, k.id] : c.filter((x) => x !== k.id)))}
            />
            {k.title} <span className="faint">({clock(k.durationMs)})</span>
          </label>
        ))}
      </div>
      <p className="small" style={{ margin: 0 }}>
        {clock(totalMs)} of their voice. {quality}
      </p>
      <label className="field">
        <span>Name in the storyteller list</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
        <span>
          <b>This is a grown-up&apos;s voice (18 or older)</b>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          <b>We have the right to use this voice</b>
          <span className="muted small">
            They&apos;ve agreed to it, or, for someone who has passed away, your family is at peace with it.
          </span>
        </span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={cleanNoise} onChange={(e) => setCleanNoise(e.target.checked)} />
        <span>
          <b>Clean up background noise</b>
          <span className="muted small">Best for voicemails and phone recordings. Turn off for recordings made in a quiet room.</span>
        </span>
      </label>
      {!enabled && <p className="notice small">Making a storytelling voice needs your ElevenLabs key (see “The engines” above).</p>}
      {error && <p className="notice notice-error small">{error}</p>}
      {busy ? (
        <WaitLine what={`Learning ${name}'s voice`} done={0} total={1} startedAt={busy.startedAt} seconds={busy.seconds} />
      ) : (
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Not now
          </button>
          <button className="btn btn-sm" onClick={make} disabled={!enabled || !adult || !consent || totalMs < 10_000 || !name.trim()}>
            Make {name || person}&apos;s storytelling voice
          </button>
        </div>
      )}
    </div>
  );
}
