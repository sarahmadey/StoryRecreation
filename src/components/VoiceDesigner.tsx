"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "./Grownup";
import { previewVoice } from "@/lib/client/sound";

/**
 * Conjure a brand-new voice from a description using ElevenLabs Voice
 * Design: "a tiny, squeaky mouse who talks very fast". Saved voices join the
 * family's wardrobe and can be cast in any story.
 */
export function VoiceDesigner({
  initialName = "",
  initialDescription = "",
  onSaved,
  onClose,
}: {
  initialName?: string;
  initialDescription?: string;
  onSaved: (voice: { voiceId: string; name: string; description: string }) => void;
  onClose: () => void;
}) {
  const api = useApi();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [previews, setPreviews] = useState<{ generatedVoiceId: string; audio: string }[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The three voices, and then the button to keep one, appear further down: bring them into view.
  const previewsRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (previews) previewsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [previews]);
  useEffect(() => {
    if (chosen) keepRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chosen]);

  const conjure = async () => {
    setBusy("Conjuring three voices…");
    setError(null);
    setChosen(null);
    try {
      const res = await api.post<{ previews: { generatedVoiceId: string; audio: string }[] }>("/api/voices/design", { description });
      setPreviews(res.previews);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The voice workshop is closed.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!chosen) return;
    setBusy("Sewing it into the wardrobe…");
    setError(null);
    try {
      const { voiceId } = await api.post<{ voiceId: string }>("/api/voices/design/save", {
        generatedVoiceId: chosen,
        name: name || "New voice",
        description,
      });
      onSaved({ voiceId, name: name || "New voice", description });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That voice couldn't be saved.");
      setBusy(null);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="vd-title">
      <div className="modal parchment stack" style={{ width: "min(620px, 100%)" }}>
        <div className="spread">
          <div>
            <div className="eyebrow">The voice workshop</div>
            <h2 id="vd-title" style={{ margin: 0 }}>
              🪄 Conjure a voice
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ color: "#3a2616", background: "rgba(255,255,255,.4)" }}>
            ✕
          </button>
        </div>
        <label className="field">
          <span>Who is it?</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ollie the Owl" />
        </label>
        <label className="field">
          <span>What do they sound like?</span>
          <textarea
            className="textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A very old, very wise owl. Slow and creaky, warm and kind, with a soft British accent and a sleepy little hoot in his voice."
          />
          <div className="hint">
            Describe personality, energy, accent, pace and texture. ElevenLabs won&apos;t make voices of young children. Each try uses a little
            ElevenLabs credit.
          </div>
        </label>
        <div className="center">
          <button className="btn" onClick={conjure} disabled={Boolean(busy) || description.trim().length < 20}>
            {busy && !previews ? busy : previews ? "Try three more" : "Conjure three voices"}
          </button>
        </div>
        {previews && (
          <div className="voice-grid" role="radiogroup" aria-label="Choose a voice" ref={previewsRef}>
            {previews.map((p, i) => (
              <div
                key={p.generatedVoiceId}
                className="voice-card"
                role="radio"
                tabIndex={0}
                aria-checked={chosen === p.generatedVoiceId}
                onClick={() => {
                  setChosen(p.generatedVoiceId);
                  previewVoice(p.audio);
                }}
              >
                <span className="voice-face">{["🌟", "🌙", "🍄"][i]}</span>
                <span className="voice-name">Voice {i + 1}</span>
                <span className="hear">▶ tap to hear</span>
              </div>
            ))}
          </div>
        )}
        {error && <p className="notice notice-error">{error}</p>}
        {chosen && (
          <div className="center" ref={keepRef}>
            <button className="btn btn-velvet" onClick={save} disabled={Boolean(busy)}>
              {busy ?? "Keep this voice"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
