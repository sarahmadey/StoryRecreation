"use client";

import { useEffect } from "react";

// Listening without signal: the service worker (public/sw.js) serves what the player saves here.

const SAVED = "storyhollow:offline";
/** How many stories are kept on the phone (recordings are a few megabytes each). */
const KEEP = 25;

interface Saved {
  id: string;
  title: string;
  book: string;
  audioUrl: string;
  at: number;
}

const read = (): Saved[] => {
  try {
    return JSON.parse(localStorage.getItem(SAVED) ?? "[]") as Saved[];
  } catch {
    return [];
  }
};

/** Start the service worker (in the built app, not while developing). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}

/** Save a story on this phone as it plays: its recording, its page and its pictures. Best effort, quietly. */
export async function keepForOffline(story: { id: string; title: string; book: string; audioUrl: string; images: string[] }) {
  if (typeof caches === "undefined" || !navigator.serviceWorker?.controller) return;
  try {
    const audio = await caches.open("sh-audio");
    if (!(await audio.match(story.audioUrl))) await audio.add(story.audioUrl);
    const pages = await caches.open("sh-pages");
    await pages.add(`/play/${story.id}`);
    const images = await caches.open("sh-images");
    await Promise.all(story.images.map(async (src) => (await images.match(src)) ?? images.add(src).catch(() => undefined)));

    // Newest first; a story re-recorded keeps only its new recording, and the oldest beyond KEEP are let go.
    const before = read();
    const after = [{ id: story.id, title: story.title, book: story.book, audioUrl: story.audioUrl, at: Date.now() }, ...before.filter((s) => s.id !== story.id)];
    const gone = [...before.filter((s) => s.id === story.id && s.audioUrl !== story.audioUrl), ...after.slice(KEEP)];
    for (const s of gone) await audio.delete(s.audioUrl);
    localStorage.setItem(SAVED, JSON.stringify(after.slice(0, KEEP)));
  } catch {
    // no room, or the network went: it simply isn't saved this time
  }
}

/** Signing out: nothing of the family's is left on the phone. */
export async function forgetOffline() {
  try {
    localStorage.removeItem(SAVED);
    for (const key of await caches.keys()) if (key.startsWith("sh-")) await caches.delete(key);
  } catch {
    // ignore
  }
}
