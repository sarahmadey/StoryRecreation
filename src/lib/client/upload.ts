import { ApiError, type useApi } from "@/components/Grownup";

// Sending things up from a phone (book photos, a child's drawing, a family recording). Each send is watched:
// the family sees how much has gone, a connection that has stopped moving is noticed (a phone's tends to
// stall rather than fail) and the send is tried again by itself, and the grown-up PIN is asked for if needed.

type Api = ReturnType<typeof useApi>;

/** How long a request may go without a byte moving before it's given up and sent again. */
const STALL_MS = 40_000;
/** Each send is tried this many times before the family is asked to try again. */
const TRIES = 3;

/** The signal dropped, or stopped moving. */
export class Lost extends Error {
  constructor() {
    super("The connection dropped.");
  }
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** Worth trying again by itself: the signal, or a server between versions (an update going out) for a moment. */
export const passing = (err: unknown) => err instanceof Lost || (err instanceof ApiError && [502, 503, 504].includes(err.status));

/** How much of what's being sent is on its way: bytes so far, of all of them. */
export type OnSent = (sent: number, total: number) => void;

/** One request, watched: given up if nothing has moved for a while. A form sets its own type. */
export function sendWatched(method: string, url: string, body: Blob | FormData | string, type?: string, onSent?: OnSent) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let moved = Date.now();
    const watch = setInterval(() => Date.now() - moved > STALL_MS && xhr.abort(), 1000);
    const end = (then: () => void) => {
      clearInterval(watch);
      then();
    };
    xhr.open(method, url);
    if (type) xhr.setRequestHeader("Content-Type", type);
    xhr.upload.onprogress = (e) => {
      moved = Date.now();
      if (e.lengthComputable) onSent?.(e.loaded, e.total);
    };
    // All of it sent: now it's the server's turn.
    xhr.upload.onload = (e) => {
      moved = Date.now();
      onSent?.(e.total || e.loaded, e.total || e.loaded);
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
export async function withRetries<T>(api: Api, attempt: () => Promise<T>): Promise<T> {
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

/** Send a form (or a file) up, watched and tried again as needed. The server's answer. */
export function upload<T>(api: Api, url: string, body: FormData | Blob, onSent?: OnSent, method = "POST"): Promise<T> {
  const type = body instanceof FormData ? undefined : body.type || "application/octet-stream";
  return withRetries(api, () => sendWatched(method, url, body, type, onSent)) as Promise<T>;
}

/** "Sending the drawing (40%)": how far a send has got, in words. */
export const sentWords = (what: string, sent: number, total: number) => (sent > 0 && sent < total ? `${what} (${Math.round((sent / total) * 100)}%)` : what);

/** What to say when something couldn't be sent: for a dropped signal, that it's fine to try again. */
export function sendTrouble(err: unknown, fallback: string): string {
  if (!passing(err)) return err instanceof Error ? err.message : fallback;
  return navigator.onLine === false
    ? "There's no signal just now. Try again once you're back online."
    : "It stopped sending (the signal may be weak). Try again in a moment.";
}

/** Keep the screen on while something long is sent: a phone that locks itself stops sending. */
export async function keepAwake(): Promise<() => void> {
  try {
    const lock = await navigator.wakeLock?.request("screen");
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}
