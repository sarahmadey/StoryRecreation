import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { HttpError } from "./auth";
import { createBook, getBook, replacePages, updateBook } from "./db";
import { IMAGE_TYPES, MAX_IMAGE_BYTES, resolveHouseholdPath } from "./files";
import type { BookKind } from "@/lib/shared/types";

// A new book's photos come in one at a time, each in a small request of its own: on a weak signal
// only the photo that was cut off is sent again, and the family sees how many are in. They wait in
// data/incoming/ (left out of backups) until they're all there; then the book is made from them at
// once, and only once, even when that last request arrives twice. Photos nobody came back for are
// let go after a day.

/** The most pages one book can have. */
export const MAX_PAGES = 60;
/** How long photos for a book that was never finished are kept. */
const KEEP_MS = 24 * 60 * 60 * 1000;
const UPLOAD_KEY = /^[A-Za-z0-9-]{8,64}$/;
const PAGE_FILE = /^(\d+)\.(jpg|png|webp|gif)$/;

export interface NewBook {
  title: string;
  kind: BookKind;
  author?: string | null;
  shelf?: string;
  folder?: string | null;
  notes?: string | null;
}

/** Some of a book's photos never arrived (or were let go): they're sent again. */
export class MissingPages extends HttpError {
  constructor(public pages: number[]) {
    super(409, `${pages.length === 1 ? `Page ${pages[0]} didn't` : `${pages.length} pages didn't`} arrive: they're being sent again.`, "missing_pages");
  }
}

function incomingDir(householdId: string, key?: string): string {
  const dir = path.join(config.dataDir, "incoming", householdId);
  if (key === undefined) return dir;
  if (!UPLOAD_KEY.test(key)) throw new HttpError(400, "That upload didn't make sense.");
  return path.join(dir, key);
}

/** Each page's photo in an upload's folder, by page number. */
async function pageFiles(dir: string): Promise<Map<number, string>> {
  const names = await fs.promises.readdir(dir).catch(() => [] as string[]);
  return new Map(names.flatMap((f) => (PAGE_FILE.test(f) ? [[Number(PAGE_FILE.exec(f)![1]), f] as const] : [])));
}

/** Keep page `n` (from 1) of a book on its way in. A page sent again replaces the one before. */
export async function receivePhoto(householdId: string, key: string, n: number, type: string, bytes: Buffer): Promise<void> {
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGES) throw new HttpError(400, `A book can have up to ${MAX_PAGES} pages.`);
  const ext = IMAGE_TYPES[type];
  if (!ext) throw new HttpError(400, "Photos need to be JPEG, PNG, WebP or GIF.");
  if (bytes.length === 0) throw new HttpError(400, "That photo arrived empty: send it again.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, "That photo is too big (8 MB max).");
  const dir = incomingDir(householdId, key);
  if (!fs.existsSync(dir)) await clearOldUploads(householdId);
  await fs.promises.mkdir(dir, { recursive: true });
  // Written to the side, then put in place: a photo cut off partway is never taken for a whole one.
  const part = path.join(dir, `${n}-${randomUUID()}.part`);
  await fs.promises.writeFile(part, bytes);
  const before = (await pageFiles(dir)).get(n);
  if (before && before !== `${n}${ext}`) await fs.promises.rm(path.join(dir, before), { force: true });
  await fs.promises.rename(part, path.join(dir, `${n}${ext}`));
}

const shelving = new Map<string, Promise<string>>();

/**
 * Put the book on the shelf with the photos that came in for pages 1 to `pages`. Only ever once: the same
 * upload sent again (its answer lost on the way back, say) gets the same book.
 */
export function shelveUpload(householdId: string, key: string, pages: number, book: NewBook): Promise<string> {
  const id = `${householdId}/${key}`;
  const running = shelving.get(id);
  if (running) return running;
  const run = shelve(householdId, key, pages, book).finally(() => shelving.delete(id));
  shelving.set(id, run);
  return run;
}

async function shelve(householdId: string, key: string, pages: number, book: NewBook): Promise<string> {
  const dir = incomingDir(householdId, key);
  const record = path.join(dir, "shelved.json");
  const already = await fs.promises.readFile(record, "utf8").then(
    (s) => (JSON.parse(s) as { bookId: string }).bookId,
    () => null,
  );
  if (already && getBook(householdId, already)) return already;
  if (!Number.isInteger(pages) || pages < 0 || pages > MAX_PAGES) throw new HttpError(400, `A book can have up to ${MAX_PAGES} pages.`);

  const arrived = await pageFiles(dir);
  const files = Array.from({ length: pages }, (_, i) => arrived.get(i + 1));
  const missing = files.flatMap((f, i) => (f ? [] : [i + 1]));
  if (missing.length) throw new MissingPages(missing);

  const bookId = createBook(householdId, book);
  const saved: string[] = [];
  for (const f of files as string[]) {
    const rel = `books/${bookId}/${randomUUID()}${path.extname(f)}`;
    const dest = resolveHouseholdPath(householdId, rel);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await move(path.join(dir, f), dest);
    saved.push(rel);
  }
  if (saved.length) {
    replacePages(bookId, saved);
    updateBook(householdId, bookId, { coverPath: saved[0] });
  }
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(record, JSON.stringify({ bookId }));
  return bookId;
}

async function move(from: string, to: string) {
  try {
    await fs.promises.rename(from, to);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
    await fs.promises.copyFile(from, to);
    await fs.promises.rm(from, { force: true });
  }
}

/** Let go of photos for books that were never finished (or were finished long ago): a day after anything last came in. */
export async function clearOldUploads(householdId?: string) {
  const top = path.join(config.dataDir, "incoming");
  const roots = householdId ? [incomingDir(householdId)] : (await fs.promises.readdir(top).catch(() => [] as string[])).map((h) => path.join(top, h));
  for (const root of roots) {
    for (const key of await fs.promises.readdir(root).catch(() => [] as string[])) {
      const dir = path.join(root, key);
      const stat = await fs.promises.stat(dir).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > KEEP_MS) await fs.promises.rm(dir, { recursive: true, force: true });
    }
  }
}

/** Once the server is up, and each day after: let go of photos nobody came back for. */
export function clearOldUploadsDaily() {
  const clear = () => clearOldUploads().catch((err) => console.error("Clearing old uploads:", err));
  setTimeout(clear, 2 * 60 * 1000).unref();
  setInterval(clear, KEEP_MS).unref();
}
