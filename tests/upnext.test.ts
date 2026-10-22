// What plays next when a story ends: a classic's next chapter (made, being made, or still to make),
// or the next story made for the same book.

import { before, test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

before(() => {
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "storyhollow-upnext-test-"));
});

test("a classic's next chapter, and a book's next story", async () => {
  const { createHousehold, createBook, createStory, getStory, updateStory, upNext } = await import("@/lib/server/db");
  const { defaultSettings } = await import("@/lib/shared/options");
  const household = createHousehold("The Reed Family", "reed@example.com", "hash");
  const classic = createBook(household, { title: "The Wind in the Willows", kind: "classic", sourceRef: "289" });
  const chapter = (n: number, status: "ready" | "recording" | "error" = "ready") =>
    createStory(household, {
      bookId: classic,
      profileId: null,
      mode: "read",
      title: `Chapter ${n + 1}`,
      settings: defaultSettings({ source: "classic", classic: { gutenbergId: 289, chapter: n } }),
      status,
    });
  const one = chapter(0);
  assert.deepEqual(upNext(household, getStory(household, one)!), { kind: "chapter", gutenbergId: 289, chapter: 1 }, "not made yet");
  chapter(1, "error");
  assert.equal(upNext(household, getStory(household, one)!)?.kind, "chapter", "a failed attempt doesn't count");
  const two = chapter(1, "recording");
  assert.deepEqual(upNext(household, getStory(household, one)!), { kind: "story", id: two, title: "Chapter 2", ready: false }, "being made");
  updateStory(two, { status: "ready" });
  assert.deepEqual(upNext(household, getStory(household, one)!), { kind: "story", id: two, title: "Chapter 2", ready: true });

  const book = createBook(household, { title: "Hoop Dreams", kind: "idea" });
  const made = (title: string) =>
    createStory(household, { bookId: book, profileId: null, mode: "create", title, settings: defaultSettings({ source: "idea" }), status: "ready" });
  const first = made("Bounce Gets a Ball");
  const second = made("Bounce Makes the Team");
  assert.deepEqual(upNext(household, getStory(household, first)!), { kind: "story", id: second, title: "Bounce Makes the Team", ready: true });
  assert.equal(upNext(household, getStory(household, second)!), null, "the newest has nothing after it");
});
