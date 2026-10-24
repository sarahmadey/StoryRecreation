import assert from "node:assert/strict";
import { test } from "node:test";
import { driveLink } from "../src/lib/shared/drive";

// A family video shared from Google Drive: its file, from however Drive wrote the link.

test("the file in a Drive link, whichever way Drive wrote it", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_-0123";
  for (const link of [
    `https://drive.google.com/file/d/${id}/view?usp=sharing`,
    `https://drive.google.com/file/d/${id}/view?usp=drive_link`,
    `https://drive.google.com/file/u/0/d/${id}/preview`,
    `https://drive.google.com/open?id=${id}`,
    `https://drive.google.com/uc?id=${id}&export=download`,
    `  https://drive.google.com/file/d/${id}  `,
  ]) {
    assert.deepEqual(driveLink(link), { id, resourceKey: null }, link);
  }
  // Some links shared before 2021 carry a key of their own.
  assert.deepEqual(driveLink(`https://drive.google.com/file/d/${id}/view?usp=sharing&resourcekey=0-AbC_dEf`), { id, resourceKey: "0-AbC_dEf" });
});

test("a folder, or something that isn't a Drive link, is told apart", () => {
  assert.deepEqual(driveLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing"), { folder: true });
  assert.equal(driveLink("https://photos.app.goo.gl/abc123"), null);
  assert.equal(driveLink("https://example.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view"), null);
  assert.equal(driveLink("drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz"), null, "not a whole link");
  assert.equal(driveLink("https://drive.google.com/file/d/short/view"), null);
  assert.equal(driveLink("Grandma's birthday video"), null);
});
