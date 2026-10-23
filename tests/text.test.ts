import { test } from "node:test";
import assert from "node:assert/strict";
import { chapterize, chunkLines, cleanGutenberg, sectionText, stripTags, withTheEnd } from "@/lib/server/text";
import { wordsPerPage } from "@/lib/shared/options";

test("lines are chunked under the dialogue limit", () => {
  const long = "The owl blinked. ".repeat(200);
  const chunks = chunkLines([
    { speaker: "narrator", text: "Once upon a time." },
    { speaker: "owl", text: long },
  ]);
  for (const c of chunks) assert.ok(c.reduce((n, l) => n + l.text.length, 0) <= 1800);
  assert.equal(chunks.flat().map((l) => l.text).join("").replace(/\s/g, ""), ("Once upon a time." + long).replace(/\s/g, ""));
});

test("sections keep every word", () => {
  const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} has some words in it.`).join("\n\n");
  const sections = sectionText(text, 200);
  assert.ok(sections.length > 3);
  assert.equal(sections.join(" ").split(/\s+/).length, text.split(/\s+/).length);
});

test("every story ends by saying so, once", () => {
  const script = {
    title: "Floss",
    synopsis: "",
    ambience: "",
    cast: [{ id: "narrator", name: "Narrator", description: "", voiceBrief: "", voiceId: "v1" }],
    pages: [
      { page: 1, picture: "", lines: [{ speaker: "narrator", text: "Once upon a time." }] },
      { page: 2, picture: "", lines: [{ speaker: "mia", text: "Goodnight, Floss!" }] },
    ],
  };
  const ended = withTheEnd(script);
  assert.deepEqual(ended.pages[1].lines.at(-1), { speaker: "narrator", text: "The end." }, "the narrator says it, last");
  assert.equal(ended.pages[0].lines.length, 1);
  assert.equal(withTheEnd(ended), ended, "not twice");
  const already = { ...script, pages: [script.pages[0], { ...script.pages[1], lines: [{ speaker: "narrator", text: "[softly] And they all slept. The End!" }] }] };
  assert.equal(withTheEnd(already), already, "a story that already ends that way is left as it is");
  assert.equal(withTheEnd(script, "That's the end of this chapter.").pages[1].lines.at(-1)!.text, "That's the end of this chapter.");
});

test("delivery tags are hidden from readers", () => {
  assert.equal(stripTags("[giggles] Knock knock! [whispers] who's there?"), "Knock knock! who's there?");
});

test("gutenberg boilerplate is removed and chapters found", () => {
  const body = Array.from(
    { length: 4 },
    (_, i) => `CHAPTER ${["I", "II", "III", "IV"][i]}\n\nTHE ${["RIVER", "WOOD", "ROAD", "HOME"][i]}\n\n${"Mole went along. ".repeat(220)}`,
  ).join("\n\n\n");
  const raw = `Header stuff\n*** START OF THE PROJECT GUTENBERG EBOOK TEST ***\n${body}\n*** END OF THE PROJECT GUTENBERG EBOOK TEST ***\nLicence`;
  const clean = cleanGutenberg(raw);
  assert.ok(!clean.includes("Licence") && !clean.includes("Header"));
  const chapters = chapterize(clean);
  assert.equal(chapters.length, 4);
  assert.equal(chapters[0].title, "Chapter I: The River");
  assert.equal(chapters[3].title, "Chapter IV: The Home");
});

test("short classics stay whole", () => {
  assert.equal(chapterize("Once upon a time there was a rabbit. ".repeat(50)).length, 1);
});

test("words per page scales with length and page count", () => {
  assert.ok(wordsPerPage("long", 12) > wordsPerPage("short", 12));
  assert.equal(wordsPerPage("short", 200), 25);
  assert.equal(wordsPerPage("long", 1), 220);
});
