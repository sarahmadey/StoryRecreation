"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FamilyVoice } from "@/lib/shared/types";

const PUT_AWAY = "storyhollow:family-voices-invite";

/**
 * Family voices, at Home. Once a loved one's voice can read: a way straight to a book or a new story read by them.
 * Until then: a word that it's possible, and where it's set up (which a family can put away).
 */
export function FamilyVoiceCard({ voices }: { voices: FamilyVoice[] }) {
  // The invitation shows once this phone has said it wasn't put away (so it never flashes up and vanishes).
  const [invite, setInvite] = useState(false);
  useEffect(() => {
    try {
      setInvite(localStorage.getItem(PUT_AWAY) !== "1");
    } catch {
      setInvite(true);
    }
  }, []);

  if (voices.length) {
    const names = voices.map((v) => v.name);
    const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
    return (
      <section className="family-card" aria-label="Family voices">
        <span className="family-card-face" aria-hidden="true">
          💛
        </span>
        <div className="family-card-text">
          <h2>{who} can read to you</h2>
          {voices.map((v) => (
            <div key={v.voiceId} className="family-card-row">
              {voices.length > 1 && <b>{v.name}</b>}
              <Link href={`/read?reader=${encodeURIComponent(v.voiceId)}`} className="btn btn-sm">
                📖 Choose something to read
              </Link>
              <Link href={`/create?narrator=${encodeURIComponent(v.voiceId)}`} className="btn btn-ghost btn-sm">
                ✨ A new story
              </Link>
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (!invite) return null;
  return (
    <section className="family-card" aria-label="Family voices">
      <span className="family-card-face" aria-hidden="true">
        💛
      </span>
      <div className="family-card-text">
        <h2>Hear someone you love read again</h2>
        <p>
          From an old voicemail or a video, the storytellers can learn the voice of someone you love, so they can read any book, poem or
          letter to you.
        </p>
        <div className="family-card-row">
          <Link href="/grownups#family-voices" className="btn btn-sm">
            Find out how →
          </Link>
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => {
              setInvite(false);
              try {
                localStorage.setItem(PUT_AWAY, "1");
              } catch {
                // ignore
              }
            }}
          >
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
