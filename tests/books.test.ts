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

test("a dreamed-up book nobody named takes its first story's title; one the family named keeps its name", async () => {
  const db = await import("@/lib/server/db");
  const { defaultSettings, madeUpBookTitle } = await import("@/lib/shared/options");
  const hh = db.createHousehold("The Glow Family", "glow@example.com", "x");
  const idea = "A shy dragon who glows when she laughs, and the owl who helps her find her friends. Then a party.";
  assert.equal(madeUpBookTitle("idea", idea), "A shy dragon who glows when she laughs, and the owl who help");
  assert.equal(madeUpBookTitle("idea", "  "), "A Dreamed-Up Tale");
  assert.equal(madeUpBookTitle("wild", "a snail"), "Our Adventure");

  const write = (bookId: string, title: string) => {
    const id = db.createStory(hh, { bookId, profileId: null, mode: "create", title: "A new story is brewing…", settings: defaultSettings({ source: "idea" }), status: "writing" });
    db.updateStory(id, { title, script: { title, synopsis: "", ambience: "", cast: [], pages: [] }, status: "draft" });
    return title;
  };
  const unnamed = db.createBook(hh, { title: madeUpBookTitle("idea", idea), kind: "idea", notes: idea });
  const named = db.createBook(hh, { title: "Hoop Dreams", kind: "idea", notes: "Adaline learns to shoot hoops." });
  const seen = db.createBook(hh, { title: "Our Adventure", kind: "wild", notes: null });
  const later = db.createBook(hh, { title: "A Dreamed-Up Tale", kind: "idea", notes: null });

  // Written before books were named this way: put right when the server starts.
  write(unnamed, "Fern Glows at the Party");
  write(named, "The Big Game");
  write(seen, "The Snail Who Raced the Rain");
  db.nameUnnamedBooks();
  assert.equal(db.getBook(hh, unnamed)!.title, "Fern Glows at the Party");
  assert.equal(db.getBook(hh, named)!.title, "Hoop Dreams");
  assert.equal(db.getBook(hh, seen)!.title, "The Snail Who Raced the Rain");

  // As the storyteller finishes: the first story names the book, and the next doesn't rename it.
  db.nameBookAfterStory(hh, later, write(later, "The Moon's Lost Hat"));
  db.nameBookAfterStory(hh, later, write(later, "The Moon Finds It Again"));
  assert.equal(db.getBook(hh, later)!.title, "The Moon's Lost Hat");
});

test("folders: books kept together, renamed, matched by name in any case, and unpacked back onto their shelves", async () => {
  const db = await import("@/lib/server/db");
  const hh = db.createHousehold("The Folder Family", "folders@example.com", "x");
  const other = db.createHousehold("The Neighbours", "neighbours@example.com", "x");
  const [beds, picnic, teeth, pumpkin] = ["Three Beds", "The Picnic", "Wobbly Tooth", "Pip and the Pumpkin"].map((title) =>
    db.createBook(hh, { title, kind: "idea" }),
  );
  const theirs = db.createBook(other, { title: "Not Yours", kind: "idea" });
  const folderOf = (id: string, household = hh) => db.getBook(household, id)!.folder;

  // Made with three books (a neighbour's book can't be put in it), and listed.
  assert.equal(db.fileBooks(hh, { name: "  Twinkle and Adaline ", bookIds: [beds, picnic, teeth, theirs] }), "Twinkle and Adaline");
  assert.deepEqual([beds, picnic, teeth, pumpkin].map((id) => folderOf(id)), ["Twinkle and Adaline", "Twinkle and Adaline", "Twinkle and Adaline", null]);
  assert.equal(folderOf(theirs, other), null);
  assert.deepEqual(db.listFolders(hh), ["Twinkle and Adaline"]);
  assert.deepEqual(db.listFolders(other), []);

  // Changed: renamed, one book taken out, another put in. The book taken out goes back on its shelf.
  assert.equal(db.fileBooks(hh, { from: "Twinkle and Adaline", name: "The Sisters", bookIds: [beds, picnic] }), "The Sisters");
  assert.deepEqual([beds, picnic, teeth].map((id) => folderOf(id)), ["The Sisters", "The Sisters", null]);
  // A new folder named like one that's there (in any case) joins it, and so does a book given that folder.
  assert.equal(db.fileBooks(hh, { name: "the sisters", bookIds: [teeth] }), "The Sisters");
  db.updateBook(hh, pumpkin, { folder: "THE SISTERS" });
  assert.deepEqual(db.listFolders(hh), ["The Sisters"]);
  assert.equal(db.getBook(hh, pumpkin)!.folder, "The Sisters");
  // Its own name in another case is a rename, not a join.
  assert.equal(db.fileBooks(hh, { from: "The Sisters", name: "the sisters", bookIds: [beds, picnic, teeth, pumpkin] }), "the sisters");
  // A book can be made straight into a folder (a new story made like one in it), and taken out of it.
  const seaside = db.createBook(hh, { title: "The Seaside", kind: "idea", folder: "The Sisters" });
  assert.equal(folderOf(seaside), "the sisters");
  db.updateBook(hh, seaside, { folder: null });
  assert.equal(folderOf(seaside), null);

  // Unpacked: no books, no folder. Nothing else changes.
  assert.equal(db.fileBooks(hh, { from: "the sisters", name: "the sisters", bookIds: [] }), null);
  assert.deepEqual(db.listFolders(hh), []);
  assert.equal(db.listBooks(hh).length, 5);
  assert.ok(db.listBooks(hh).every((b) => b.folder === null && b.shelf === "Dreamed-Up Tales"));
});
