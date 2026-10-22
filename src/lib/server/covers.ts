import { gutenbergCover } from "@/lib/shared/gutenberg";
import { MAX_IMAGE_BYTES, saveImageBytes } from "./files";
import { classicsWithoutCovers, updateBook } from "./db";

// A classic's cover is kept with the book once it's on the family's shelf: it shows even when Project
// Gutenberg is slow or down (or there's no signal), and it's in the backups with everything else.

/** Fetch a classic's cover from Project Gutenberg and keep it as the book's own. Quietly does nothing if it can't. */
export async function keepClassicCover(householdId: string, bookId: string, gutenbergId: string | number, url = gutenbergCover(gutenbergId)): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!res.ok || !type.startsWith("image/")) return false;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return false;
    const coverPath = await saveImageBytes(householdId, `books/${bookId}`, bytes, type);
    updateBook(householdId, bookId, { coverPath });
    return true;
  } catch {
    return false;
  }
}

/** Once the server is up: keep a copy of every classic's cover that isn't kept yet (books shelved before this). */
export function keepMissingCoversSoon() {
  setTimeout(async () => {
    for (const book of classicsWithoutCovers()) await keepClassicCover(book.householdId, book.id, book.sourceRef);
  }, 60 * 1000).unref();
}
