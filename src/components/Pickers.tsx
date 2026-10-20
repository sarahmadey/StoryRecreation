"use client";

import { useEffect, useRef, useState } from "react";
import { pickPhotos, type PickedPhoto } from "@/lib/client/images";
import { previewChime, previewVoice } from "@/lib/client/sound";
import { CHIMES } from "@/lib/shared/options";
import type { ChimeSettings, ChimeStyle, VoiceOption } from "@/lib/shared/types";
import { useApi } from "./Grownup";

// ------------------------------------------------------------------ photos

export function PhotoPicker({
  photos,
  onChange,
  label = "Page",
  max = 60,
}: {
  photos: PickedPhoto[];
  onChange: (p: PickedPhoto[]) => void;
  label?: string;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState("");

  // Many photos at once: from the photo library, or dragged onto the page.
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setNote("");
    setBusy("Developing…");
    const { photos: picked, extra } = await pickPhotos(files, max - photos.length, (done, total) =>
      setBusy(total > 1 ? `Developing ${done + 1} of ${total}…` : "Developing…"),
    );
    onChange([...photos, ...picked]);
    if (extra > 0) setNote(`${max} ${label.toLowerCase()}s is the most for one story, so ${extra} ${extra === 1 ? "photo wasn't" : "photos weren't"} added.`);
    setBusy(null);
  };
  const move = (i: number, d: number) => {
    const next = [...photos];
    const [p] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + d)), 0, p);
    onChange(next);
  };
  const remove = (i: number) => onChange(photos.filter((_, j) => j !== i));

  return (
    <div
      className={`photo-picker${dragging ? " dragging" : ""}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files") || photos.length >= max) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        void add(e.dataTransfer.files);
      }}
    >
      {photos.length > 1 && (
        <div className="row" style={{ justifyContent: "flex-end", marginBottom: 10 }}>
          <span className="hint" style={{ margin: 0, marginRight: "auto" }}>
            Out of order? The storyteller also reads printed page numbers and sorts them out.
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...photos].reverse())}>
            ⇅ Reverse order
          </button>
        </div>
      )}
      <div className="photo-grid">
        {photos.map((p, i) => (
          <div className="photo" key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={`${label} ${i + 1}`} />
            <span className="photo-num">{i + 1}</span>
            <div className="photo-tools">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${label} ${i + 1} earlier`}>
                ←
              </button>
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${label} ${i + 1}`}>
                ✕
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === photos.length - 1}
                aria-label={`Move ${label} ${i + 1} later`}
              >
                →
              </button>
            </div>
          </div>
        ))}
        {photos.length < max && (
          <>
            <button type="button" className="dropzone" onClick={() => camRef.current?.click()} disabled={!!busy}>
              <b>📷</b>
              {busy ?? `Snap ${label.toLowerCase()} ${photos.length + 1}`}
            </button>
            <button type="button" className="dropzone" onClick={() => fileRef.current?.click()} disabled={!!busy}>
              <b>🖼️</b>
              Choose photos
              <small>
                Pick several at once<span className="drop-hint">, or drop them here</span>
              </small>
            </button>
          </>
        )}
      </div>
      {note && (
        <p className="hint" role="status">
          {note}
        </p>
      )}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ voices

export function useVoices() {
  const api = useApi();
  const [voices, setVoices] = useState<VoiceOption[] | null>(null);
  useEffect(() => {
    api
      .get<{ voices: VoiceOption[] }>("/api/voices")
      .then((r) => setVoices(r.voices))
      .catch(() => setVoices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return voices;
}

/** Speak a short sample with the browser's voice when no recorded sample exists. */
function speakSample(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export function VoicePicker({
  voices,
  value,
  onChange,
  allowAuto = true,
  narratorsOnly = true,
}: {
  voices: VoiceOption[] | null;
  value: string | null;
  onChange: (id: string | null) => void;
  allowAuto?: boolean;
  narratorsOnly?: boolean;
}) {
  if (!voices) return <p className="muted">Gathering the storytellers…</p>;
  // family voices first: Grandma reading is the most special storyteller of all
  const family = voices.filter((v) => v.source === "family");
  const personas = voices.filter((v) => v.persona);
  const rest = voices.filter((v) => !v.persona && v.source !== "default" && v.source !== "family");
  const shown = narratorsOnly ? [...family, ...personas, ...rest] : voices;

  const hear = (v: VoiceOption) => {
    if (!previewVoice(v.previewUrl)) speakSample(`Hello! I'm ${v.persona?.name ?? v.name}.`);
  };

  return (
    <div className="voice-grid" role="radiogroup" aria-label="Storyteller">
      {allowAuto && (
        <div
          className="voice-card"
          role="radio"
          tabIndex={0}
          aria-checked={value === null}
          onClick={() => onChange(null)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(null)}
        >
          <span className="voice-face">🎭</span>
          <span className="voice-name">Casting director’s choice</span>
          <span className="voice-tag">The perfect voice for this story</span>
        </div>
      )}
      {shown.map((v) => (
        <div
          key={v.voiceId}
          className="voice-card"
          role="radio"
          tabIndex={0}
          aria-checked={value === v.voiceId}
          onClick={() => onChange(v.voiceId)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(v.voiceId)}
        >
          <span className="voice-face">{v.persona?.emoji ?? (v.source === "family" ? "💛" : v.source === "designed" ? "🪄" : "🗣️")}</span>
          <span className="voice-name">{v.persona?.name ?? v.name}</span>
          <span className="voice-tag">{v.persona?.tagline ?? v.description}</span>
          <button
            type="button"
            className="hear"
            onClick={(e) => {
              e.stopPropagation();
              hear(v);
            }}
          >
            ▶ Hear me
          </button>
        </div>
      ))}
    </div>
  );
}

export function VoiceSelect({
  voices,
  value,
  onChange,
  id,
}: {
  voices: VoiceOption[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const known = voices.some((v) => v.voiceId === value);
  return (
    <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {!known && <option value={value}>Current voice</option>}
        {voices.map((v) => (
          <option key={v.voiceId} value={v.voiceId}>
            {v.persona ? `${v.persona.emoji} ${v.persona.name} (${v.name})` : `${v.source === "family" ? "💛 " : v.source === "designed" ? "🪄 " : ""}${v.name}`}
            {v.persona ? "" : v.description ? `: ${v.description.slice(0, 40)}` : ""}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="hear"
        onClick={() => {
          const v = voices.find((x) => x.voiceId === value);
          if (!previewVoice(v?.previewUrl)) speakSample(`Hello, I'm ${v?.persona?.name ?? v?.name ?? "a storyteller"}.`);
        }}
        aria-label="Hear this voice"
      >
        ▶
      </button>
    </div>
  );
}

// ------------------------------------------------------------------ chime

export type SoundsChoice = "none" | "effects" | "soundscape";

export const soundsOf = (s: { effects: boolean; ambience: boolean }): SoundsChoice => (s.effects ? "effects" : s.ambience ? "soundscape" : "none");

const SOUNDS: Record<SoundsChoice, { emoji: string; label: string; sub: string }> = {
  none: { emoji: "🎙️", label: "Just the voices", sub: "Nothing underneath" },
  effects: { emoji: "🦉", label: "Sound effects", sub: "A few short sounds at just the right moments: a door's creak, an owl's hoot" },
  soundscape: { emoji: "🌧️", label: "Soft soundscape", sub: "A quiet background the whole way through" },
};

/** What plays besides the voices. The continuous soundscape is only offered where a story already has it. */
export function SoundsPicker({ value, onChange }: { value: SoundsChoice; onChange: (v: SoundsChoice) => void }) {
  const options = (Object.keys(SOUNDS) as SoundsChoice[]).filter((k) => k !== "soundscape" || value === "soundscape");
  return (
    <div>
      <span className="label">Sounds</span>
      <div className="choices" style={{ ["--min" as string]: "150px" }} role="radiogroup" aria-label="Sounds">
        {options.map((k) => (
          <button key={k} type="button" className="choice" role="radio" aria-checked={value === k} onClick={() => onChange(k)}>
            <span className="choice-emoji">{SOUNDS[k].emoji}</span>
            <span className="choice-title">{SOUNDS[k].label}</span>
            <span className="choice-sub">{SOUNDS[k].sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChimePicker({ value, onChange }: { value: ChimeSettings; onChange: (c: ChimeSettings) => void }) {
  return (
    <div className="stack" style={{ ["--gap" as string]: "14px" }}>
      <label className="toggle">
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        <span>
          <b>Ring a chime when it's time to turn the page</b>
          <span className="muted small">A soft little sound between pages, just like the read-along records.</span>
        </span>
      </label>
      {value.enabled && (
        <>
          <div className="choices" style={{ ["--min" as string]: "140px" }} role="radiogroup" aria-label="Chime">
            {(Object.keys(CHIMES) as ChimeStyle[]).map((style) => (
              <button
                key={style}
                type="button"
                className="choice"
                role="radio"
                aria-checked={value.style === style}
                onClick={() => {
                  previewChime(style);
                  onChange({ ...value, style });
                }}
              >
                <span className="choice-emoji">{CHIMES[style].emoji}</span>
                <span className="choice-title">{CHIMES[style].label}</span>
                <span className="choice-sub">tap to hear</span>
              </button>
            ))}
          </div>
          <label className="field">
            <span>Time to turn the page: {value.gapSeconds} seconds</span>
            <input
              type="range"
              min={1}
              max={8}
              step={1}
              value={value.gapSeconds}
              onChange={(e) => onChange({ ...value, gapSeconds: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "#a8792b" }}
            />
            <div className="hint">Little hands may need longer. In the player you can also choose “wait for me”.</div>
          </label>
        </>
      )}
    </div>
  );
}
