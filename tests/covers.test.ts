// A classic's cover is kept with the book: fetched once from Project Gutenberg (here, a stand-in),
// saved with the family's files, and shown from there.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { AddressInfo } from "node:net";

let server: http.Server;
let base = "";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

before(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/cover.jpg") {
      res.writeHead(200, { "content-type": "image/jpeg" });
      return res.end(JPEG);
    }
    if (req.url === "/page.html") {
      res.writeHead(200, { "content-type": "text/html" });
      return res.end("<html>not a picture</html>");
    }
    res.writeHead(404).end();
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "storyhollow-covers-test-"));
});

after(() => server.close());

test("a classic's cover is kept with the book, and shown from there", async () => {
  const { createHousehold, createBook, getBook, classicsWithoutCovers } = await import("@/lib/server/db");
  const { keepClassicCover } = await import("@/lib/server/covers");
  const { resolveHouseholdPath } = await import("@/lib/server/files");
  const household = createHousehold("The Fern Family", "fern@example.com", "hash");
  const book = createBook(household, { title: "The Tale of Peter Rabbit", kind: "classic", sourceRef: "14838" });

  // Before: the cover is Gutenberg's, and the book is waiting for its own copy.
  assert.match(getBook(household, book)!.coverUrl!, /gutenberg\.org\/cache\/epub\/14838\//);
  assert.deepEqual(classicsWithoutCovers().map((b) => b.id), [book]);

  // Gutenberg unreachable, or not a picture: nothing changes.
  assert.equal(await keepClassicCover(household, book, 14838, `${base}/missing.jpg`), false);
  assert.equal(await keepClassicCover(household, book, 14838, `${base}/page.html`), false);
  assert.equal(await keepClassicCover(household, book, 14838, "http://127.0.0.1:1/cover.jpg"), false);
  assert.match(getBook(household, book)!.coverUrl!, /gutenberg\.org/);

  assert.equal(await keepClassicCover(household, book, 14838, `${base}/cover.jpg`), true);
  const coverUrl = getBook(household, book)!.coverUrl!;
  assert.match(coverUrl, /^\/api\/files\/books\/[^/]+\/[0-9a-f-]+\.jpg$/);
  assert.deepEqual(fs.readFileSync(resolveHouseholdPath(household, coverUrl.replace("/api/files/", ""))), JPEG);
  assert.deepEqual(classicsWithoutCovers(), [], "nothing left to fetch");
});
