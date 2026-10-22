"use client";

import { ART_STYLES, SKETCHES, bookPictures } from "@/lib/shared/art";
import type { ArtStyle } from "@/lib/shared/types";

/** The illustrator's styles, as choice cards. */
export function StylePicker({ value, onChange }: { value: ArtStyle; onChange: (s: ArtStyle) => void }) {
  return (
    <div className="choices" style={{ ["--min" as string]: "140px" }} role="radiogroup" aria-label="Picture style">
      {(Object.keys(ART_STYLES) as ArtStyle[]).map((s) => (
        <button key={s} type="button" className="choice" role="radio" aria-checked={value === s} onClick={() => onChange(s)}>
          <span className="choice-emoji">{ART_STYLES[s].emoji}</span>
          <span className="choice-title">{ART_STYLES[s].label}</span>
          <span className="choice-sub">{ART_STYLES[s].blurb}</span>
        </button>
      ))}
    </div>
  );
}

/** About what a whole picture book costs: a few sketches of the main characters, the cover and every page. */
export const bookEstimate = (pages: number, each: number, mainCharacters = 2) => (bookPictures(pages) + mainCharacters * SKETCHES) * each;
