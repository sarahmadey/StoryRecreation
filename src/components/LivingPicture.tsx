"use client";

import { useMemo } from "react";
import type { SceneEffect } from "@/lib/shared/types";

// Living pictures: while a page is read, its picture drifts slowly (a gentle
// camera move, different from page to page), and the storyteller's chosen
// touch (fairy dust, snow, fireflies…) floats over it. Pure CSS: free, works
// offline, pauses with the story, and rests for anyone who prefers less motion.

const DRIFTS = ["drift-a", "drift-b", "drift-c", "drift-d"];

/** A picture that drifts for as long as its page lasts, in step with the story (`offset` seconds in, paused when it is). */
export function DriftingImage({ src, alt, page, seconds, offset, playing }: { src: string; alt: string; page: number; seconds: number; offset: number; playing: boolean }) {
  return (
    <div
      className={`drift ${DRIFTS[page % DRIFTS.length]}`}
      style={{
        animationDuration: `${Math.max(4, seconds)}s`,
        animationDelay: `${-Math.max(0, Math.min(offset, seconds))}s`,
        animationPlayState: playing ? "running" : "paused",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} />
    </div>
  );
}

const COUNTS: Record<Exclude<SceneEffect, "none">, number> = {
  sparkles: 18,
  snow: 28,
  rain: 36,
  fireflies: 12,
  leaves: 10,
  stars: 22,
  bubbles: 12,
  petals: 12,
};

/** The same "random" every time, so the page draws identically on the server and in the browser. */
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export function SceneEffects({ effect, playing }: { effect: SceneEffect; playing: boolean }) {
  const specks = useMemo(() => {
    if (effect === "none") return [];
    return Array.from({ length: COUNTS[effect] }, (_, i) => {
      const slow = effect === "rain" ? 0.6 + rand(i, 3) * 0.5 : effect === "stars" ? 2 + rand(i, 3) * 2.5 : 5 + rand(i, 3) * 8;
      return {
        "--x": `${Math.round(rand(i, 1) * 100)}%`,
        "--y": `${Math.round(rand(i, 2) * (effect === "stars" ? 55 : 100))}%`,
        "--d": `${slow.toFixed(2)}s`,
        "--delay": `${(-rand(i, 4) * slow).toFixed(2)}s`,
        "--s": `${(effect === "bubbles" ? 8 + rand(i, 5) * 12 : effect === "fireflies" ? 4 + rand(i, 5) * 3 : 2 + rand(i, 5) * 5).toFixed(1)}px`,
        "--sway": `${Math.round((rand(i, 6) - 0.5) * (effect === "petals" ? 120 : 30))}px`,
        "--rot": `${Math.round(rand(i, 7) * 540 - 270)}deg`,
      } as React.CSSProperties;
    });
  }, [effect]);
  if (effect === "none") return null;
  return (
    <div className={`scene-effect fx-${effect} ${playing ? "" : "paused"}`} aria-hidden="true">
      {specks.map((style, i) => (
        <span key={i} style={style} />
      ))}
    </div>
  );
}
