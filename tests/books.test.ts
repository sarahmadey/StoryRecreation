// Adding a book from a phone: its photos come in one at a time (a page sent again replaces the one before),
// then the book is made from them once, however many times that last step is sent. Photos nobody came back
// for are let go after a day.

import { before, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const jpeg = (label: string) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(label), Buffer.from([0xff, 0xd9])]);

before(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "storyhollow-books-test-"));
});

test("a new book's photos come in one at a time, and the book is made from them just once", async () => {
  const db = await import("@/lib/server/db");
  const { receivePhoto, shelveUpload, MissingPages } = await import("@/lib/server/uploads");
  const { resolveHouseholdPath } = await import("@/lib/server/files");
  const hh = db.createHousehold("The Lantern Family", "lantern@example.com", "x");
  const key = randomUUID();
  const incoming = path.join(process.env.DATA_DIR!, "incoming", hh, key);

  await receivePhoto(hh, key, 1, "image/jpeg", jpeg("page one"));
  await receivePhoto(hh, key, 2, "image/png", Buffer.from("a page cut off on the way"));
  await receivePhoto(hh, key, 2, "image/jpeg", jpeg("page two")); // sent again: it replaces the one before
  await receivePhoto(hh, key, 3, "image/jpeg", jpeg("page three"));
  assert.deepEqual(fs.readdirSync(incoming).sort(), ["1.jpg", "2.jpg", "3.jpg"]);

  // A page that never arrived is named, so it can be sent again.
  const book = { title: "Babette", kind: "shadow_book" as const };
  await assert.rejects(shelveUpload(hh, key, 4, book), (err: unknown) => {
    assert.ok(err instanceof MissingPages);
    assert.deepEqual(err.pages, [4]);
    assert.equal(err.status, 409);
    assert.equal(err.code, "missing_pages");
    return true;
  });

  // Sent twice at once (an answer lost on the way back, then tried again), and again later: one book.
  const [a, b] = await Promise.all([shelveUpload(hh, key, 3, book), shelveUpload(hh, key, 3, book)]);
  assert.equal(a, b);
  assert.equal(await shelveUpload(hh, key, 3, book), a);
  assert.deepEqual(
    db.listBooks(hh).map((x) => x.title),
    ["Babette"],
  );

  const pages = db.listPageRows(a);
  assert.deepEqual(
    pages.map((p) => fs.readFileSync(resolveHouseholdPath(hh, p.image_path), "latin1").slice(4, -2)),
    ["page one", "page two", "page three"],
  );
  assert.ok(pages.every((p) => p.image_path.startsWith(`books/${a}/`)));
  const shelved = db.getBook(hh, a)!;
  assert.equal(shelved.kind, "shadow_book");
  assert.equal(shelved.pageCount, 3);
  assert.ok(shelved.coverUrl?.includes(path.basename(pages[0].image_path)));
  // The photos moved into the book: only the note of which book they became is left behind.
  assert.deepEqual(fs.readdirSync(incoming), ["shelved.json"]);
});

test("a book with no photos (a story from an idea) is made once too", async () => {
  const db = await import("@/lib/server/db");
  const { shelveUpload } = await import("@/lib/server/uploads");
  const hh = db.createHousehold("The Comet Family", "comet@example.com", "x");
  const key = randomUUID();
  const id = await shelveUpload(hh, key, 0, { title: "A Dreamed-Up Tale", kind: "idea", notes: "A comet who is shy." });
  assert.equal(await shelveUpload(hh, key, 0, { title: "A Dreamed-Up Tale", kind: "idea" }), id);
  assert.equal(db.listBooks(hh).length, 1);
  assert.equal(db.getBook(hh, id)!.notes, "A comet who is shy.");
  assert.equal(db.listPageRows(id).length, 0);
});

test("photos that can't be kept are turned away, with a reason", async () => {
  const db = await import("@/lib/server/db");
  const { receivePhoto, MAX_PAGES } = await import("@/lib/server/uploads");
  const { MAX_IMAGE_BYTES } = await import("@/lib/server/files");
  const hh = db.createHousehold("The Puddle Family", "puddle@example.com", "x");
  const key = randomUUID();
  const turnedAway = async (send: Promise<void>, status: number, words: RegExp) =>
    assert.rejects(send, (err: { status?: number; message?: string }) => {
      assert.equal(err.status, status);
      assert.match(err.message ?? "", words);
      return true;
    });
  await turnedAway(receivePhoto(hh, "../../escape", 1, "image/jpeg", jpeg("x")), 400, /didn't make sense/);
  await turnedAway(receivePhoto(hh, key, 0, "image/jpeg", jpeg("x")), 400, /up to 60 pages/);
  await turnedAway(receivePhoto(hh, key, MAX_PAGES + 1, "image/jpeg", jpeg("x")), 400, /up to 60 pages/);
  await turnedAway(receivePhoto(hh, key, 1, "image/heic", jpeg("x")), 400, /JPEG, PNG, WebP or GIF/);
  await turnedAway(receivePhoto(hh, key, 1, "image/jpeg", Buffer.alloc(0)), 400, /empty/);
  await turnedAway(receivePhoto(hh, key, 1, "image/jpeg", Buffer.alloc(MAX_IMAGE_BYTES + 1)), 413, /too big/);
});

test("photos for a book that was never finished are let go after a day", async () => {
  const db = await import("@/lib/server/db");
  const { receivePhoto, clearOldUploads } = await import("@/lib/server/uploads");
  const hh = db.createHousehold("The Moss Family", "moss@example.com", "x");
  const [old, fresh] = [randomUUID(), randomUUID()];
  await receivePhoto(hh, old, 1, "image/jpeg", jpeg("left behind"));
  await receivePhoto(hh, fresh, 1, "image/jpeg", jpeg("still coming"));
  const dir = (key: string) => path.join(process.env.DATA_DIR!, "incoming", hh, key);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  fs.utimesSync(dir(old), twoDaysAgo, twoDaysAgo);
  await clearOldUploads();
  assert.equal(fs.existsSync(dir(old)), false);
  assert.equal(fs.existsSync(dir(fresh)), true);
});
