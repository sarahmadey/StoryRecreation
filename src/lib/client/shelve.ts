import { ApiError, type useApi } from "@/components/Grownup";
import type { PickedPhoto } from "./images";

// Putting a new book on the shelf from a phone. Its photos go up one at a time, each in a small request
// of its own: the family sees how many are in, a photo the signal drops is sent again by itself, and a
// connection that has stopped moving is noticed (a phone's tends to stall rather than fail). Then the
// book is made from them, once: trying again carries on where it stopped and never shelves two.

type Api = ReturnType<typeof useApi>;

/** How long a request may go without a byte moving before it's given up and sent again. */
const STALL_MS = 40_000;
/** Each photo, and the last step, is tried this many times before the family is asked to try again. */
const TRIES = 3;

/** A book on its way to the shelf. Kept between tries, so trying again carries on where it stopped. */
export interface Shelving {
  key: string;
  /** Which photo is already in, by page number. */
  sent: Map<number, string>;
}

export const newShelving = (): Shelving => ({ key: crypto.randomUUID(), sent: new Map() });

/** Sending page `sending` of `of` (`fraction` of all the photos is in), then making the book. */
export type ShelfStep = { sending: number; of: number; fraction: number } | "shelving";

/** The signal dropped, or stopped moving. */
class Lost extends Error {
  constructor() {
    super("The connection dropped.");
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** A server between versions (an update going out) answers like this for a moment. */
const passing = (err: unknown) => err instanceof Lost || (err instanceof ApiError && [502, 503, 504].includes(err.status));

/** One request, watched: given up if nothing has moved for a while. */
function send(method: string, url: string, body: Blob | string, type: string, onSent?: (bytes: number) => void) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let moved = Date.now();
    const watch = setInterval(() => Date.now() - moved > STALL_MS && xhr.abort(), 1000);
    const end = (then: () => void) => {
      clearInterval(watch);
      then();
    };
    xhr.open(method, url);
    xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => {
      moved = Date.now();
      onSent?.(e.loaded);
    };
    xhr.onprogress = () => (moved = Date.now());
    xhr.onload = () =>
      end(() => {
        let data: Record<string, unknown> = {};
        try {
          data = JSON.parse(xhr.responseText || "{}");
        } catch {
          // not from the app (a gateway's error page, say)
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(String(data.error ?? `Request failed (${xhr.status})`), xhr.status, data.code as string | undefined, data));
      });
    xhr.onerror = xhr.onabort = () => end(() => reject(new Lost()));
    xhr.send(body);
  });
}

/** Tried again when the signal drops, and after the grown-up PIN when it's asked for. */
async function tried<T>(api: Api, attempt: () => Promise<T>): Promise<T> {
  for (let tries = 1, asked = 0; ; ) {
    try {
      return await attempt();
    } catch (err) {
      if (err instanceof ApiError && err.code === "pin_required" && asked++ < 3 && (await api.askPin())) continue;
      if (err instanceof ApiError && err.code === "signed_out") window.location.href = "/welcome";
      if (!passing(err) || tries >= TRIES) throw err;
      await pause(tries++ * 2000);
    }
  }
}

/** Keep the screen on while the photos go: a phone that locks itself stops sending them. */
async function keepAwake(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request("screen");
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}

/** Send the book's photos (those not in yet), then make the book from them. Its id. */
export async function shelveBook(
  api: Api,
  shelving: Shelving,
  book: { title: string; kind: string; notes?: string },
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
        await tried(api, () => send("PUT", url, photo.file, photo.file.type || "application/octet-stream", step));
        shelving.sent.set(page, photo.id);
      }
      before += photo.file.size;
    }
  };
  const shelve = async () => {
    onStep("shelving");
    const body = JSON.stringify({ ...book, upload: shelving.key, pages: photos.length });
    return String((await tried(api, () => send("POST", "/api/books", body, "application/json"))).id);
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
