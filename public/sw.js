// Storyhollow's service worker: the stories you've listened to keep working without signal (in the car,
// on a plane). The player saves a story's recording, page and pictures as it plays; this serves them
// from the phone when the network can't. Everything else still comes from the server when it can.

const STATIC = "sh-static-v1"; // the app's own scripts, styles and fonts (they never change once built)
const PAGES = "sh-pages"; // pages, for opening when there's no signal
const IMAGES = "sh-images"; // covers and page pictures
const AUDIO = "sh-audio"; // recordings, saved by the player (never cached here part by part)
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PAGES).then((cache) => cache.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith("sh-static-") && key !== STATIC) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

/** Keep a cache to its newest `max` entries. */
async function trim(name, max) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(key);
}

async function cacheFirst(name, request) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Pictures: straight from the phone when it has them, refreshed from the server in the background. */
async function picture(request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
        cache.put(request, res.clone());
        trim(IMAGES, 400);
      }
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

/** A saved recording, cut to the part the player asks for (it plays by asking for ranges of bytes). */
async function recording(request) {
  const hit = await (await caches.open(AUDIO)).match(request.url);
  if (!hit) return fetch(request);
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") || "");
  if (!range) return hit;
  const blob = await hit.blob();
  const size = blob.size;
  let start = range[1] ? Number(range[1]) : size - Number(range[2]);
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  start = Math.max(0, Math.min(start, size - 1));
  end = Math.max(start, Math.min(end, size - 1));
  const part = blob.slice(start, end + 1);
  return new Response(part, {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": hit.headers.get("content-type") || "audio/mpeg",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": String(part.size),
      "Accept-Ranges": "bytes",
    },
  });
}

/** Pages: from the server, kept for later; from the phone when the server can't be reached (or is very slow). */
async function page(request) {
  const cache = await caches.open(PAGES);
  const network = fetch(request).then((res) => {
    if (res.ok && !res.redirected && (res.headers.get("content-type") || "").includes("text/html")) {
      cache.put(request, res.clone());
      trim(PAGES, 80);
    }
    return res;
  });
  const saved = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
  try {
    if (!saved) return await network;
    return await Promise.race([network, new Promise((_, fail) => setTimeout(fail, 4000))]);
  } catch {
    return saved || (await cache.match(OFFLINE));
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) return event.respondWith(cacheFirst(STATIC, request));
  if (url.pathname.startsWith("/api/files/")) {
    return event.respondWith(/\.mp3$/i.test(url.pathname) ? recording(request) : picture(request));
  }
  if (request.mode === "navigate") return event.respondWith(page(request));
  // Moving between pages inside the app: with no signal, answer so the app opens the page itself,
  // which then comes from the phone as above.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) {
    return event.respondWith(fetch(request).catch(() => new Response("", { status: 503, headers: { "Content-Type": "text/html" } })));
  }
});
