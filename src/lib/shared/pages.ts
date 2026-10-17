import type { BookPage, StorySource } from "./types";

/** Which photo goes with a story page. Book pages map 1:1; wild photos spread across the story. */
export function imageForPage(page: number, photos: BookPage[], source: StorySource, totalPages: number): string | null {
  if (!photos.length || page < 1) return null;
  if (source === "book" || source === "book_read") return photos[page - 1]?.imageUrl ?? null;
  if (source === "wild") {
    const i = Math.min(photos.length - 1, Math.floor(((page - 1) * photos.length) / Math.max(1, totalPages)));
    return photos[i].imageUrl;
  }
  return null;
}
