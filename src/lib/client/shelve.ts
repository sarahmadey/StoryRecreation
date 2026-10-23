import { ApiError, type useApi } from "@/components/Grownup";
import type { PickedPhoto } from "./images";
import { keepAwake, passing, sendWatched, withRetries } from "./upload";

// Putting a new book on the shelf from a phone. Its photos go up one at a time, each in a small request
// of its own: the family sees how many are in, a photo the signal drops is sent again by itself, and a
// connection that has stopped moving is noticed. Then the book is made from them, once: trying again
// carries on where it stopped and never shelves two.

type Api = ReturnType<typeof useApi>;

/** A book on its way to the shelf. Kept between tries, so trying again carries on where it stopped. */
export interface Shelving {
  key: string;
  /** Which photo is already in, by page number. */
  sent: Map<number, string>;
}

export const newShelving = (): Shelving => ({ key: crypto.randomUUID(), sent: new Map() });

/** Sending page `sending` of `of` (`fraction` of all the photos is in), then making the book. */
export type ShelfStep = { sending: number; of: number; fraction: number } | "shelving";

/** Send the book's photos (those not in yet), then make the book from them. Its id. */
export async function shelveBook(
  api: Api,
  shelving: Shelving,
  book: { title: string; kind: string; notes?: string; folder?: string },
  photos: PickedPhoto[],
  onStep: (step: ShelfStep) => void,
): Promise<string> {
  const total = photos.reduce((sum, p) => sum + p.file.size, 0) || 1;
  const sendPhotos = async () => {
    let before = 0;
    for (const [i, photo] of photos.entries()) {
      const page = i + 1;
      const step = (bytes: number) => onStep({ sending: page, of: photos.length, fraction: (before + Math.min(bytes, photo.file.size)) / total });
      step(0);
      if (shelving.sent.get(page) !== photo.id) {
        const url = `/api/uploads/${shelving.key}/${page}`;
        await withRetries(api, () => sendWatched("PUT", url, photo.file, photo.file.type || "application/octet-stream", step));
        shelving.sent.set(page, photo.id);
      }
      before += photo.file.size;
    }
  };
  const shelve = async () => {
    onStep("shelving");
    const body = JSON.stringify({ ...book, upload: shelving.key, pages: photos.length });
    return String((await withRetries(api, () => sendWatched("POST", "/api/books", body, "application/json"))).id);
  };

  const release = await keepAwake();
  try {
    await sendPhotos();
    try {
      return await shelve();
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "missing_pages")) throw err;
      // The library didn't get some of them after all (rare): those go again.
      const missing = (err.details?.missing as number[] | undefined) ?? [...shelving.sent.keys()];
      missing.forEach((page) => shelving.sent.delete(page));
      await sendPhotos();
      return await shelve();
    }
  } finally {
    release();
  }
}

/** "Sending page 3 of 8…", then what making the book is called. */
export function shelfWords(step: ShelfStep, shelving = "Putting it on the shelf…"): string {
  if (step === "shelving") return shelving;
  return step.of > 1 ? `Sending page ${step.sending} of ${step.of}…` : "Sending the photo…";
}

/** What to tell the family when it couldn't finish: for a dropped signal, that tapping `again` carries on. */
export function shelfTrouble(err: unknown, shelving: Shelving, pages: number, again = "Try again"): string {
  if (!passing(err)) return err instanceof Error ? err.message : "The book couldn't be put on the shelf.";
  const done = [...shelving.sent.keys()].filter((page) => page <= pages).length;
  const sofar = done > 0 && done < pages ? ` ${done} of ${pages} photos are in.` : "";
  return navigator.onLine === false
    ? `There's no signal just now.${sofar} Your photos are safe here: tap ${again} once you're back online.`
    : `The photos stopped sending (the signal may be weak).${sofar} Tap ${again}: it carries on where it stopped.`;
}
