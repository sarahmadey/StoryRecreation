// Exercises the real Claude and ElevenLabs SDK calls against a local fake of
// both APIs, checking what we send (models, fallbacks, schema, voices) and
// that we read the replies (streamed JSON, PCM audio, timings) correctly.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { AddressInfo } from "node:net";

interface Captured {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: unknown;
}
const captured: Captured[] = [];
let server: http.Server;
let scriptJson = "";

const PERSONA_VOICE = "JBFqnCBsd6RMkjVDRZzb";
const OWL_VOICE = "pqHfZKP75CvOlQylNhV4";

function sse(res: http.ServerResponse, text: string) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send("message_start", {
    type: "message_start",
    message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } },
  });
  send("content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
  for (let i = 0; i < text.length; i += 40) {
    send("content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: text.slice(i, i + 40) } });
  }
  send("content_block_stop", { type: "content_block_stop", index: 0 });
  send("message_delta", { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 200 } });
  send("message_stop", { type: "message_stop" });
  res.end();
}

function pcmBase64(seconds: number): string {
  const n = Math.round(24000 * seconds);
  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / 24000) * 6000), i * 2);
  return buf.toString("base64");
}

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = raw ? JSON.parse(raw) : null;
      captured.push({ method: req.method!, url: req.url!, headers: req.headers, body });
      if (req.url!.startsWith("/v1/messages")) return sse(res, scriptJson);
      if (req.url!.startsWith("/v1/text-to-dialogue/with-timestamps")) {
        const inputs = (body as { inputs: { text: string; voice_id: string }[] }).inputs;
        const text = inputs.map((i) => i.text).join(" ");
        const chars = [...text];
        let at = 0;
        const segments = inputs.map((inp, idx) => {
          const seg = {
            voice_id: inp.voice_id,
            start_time_seconds: at * 0.05,
            end_time_seconds: (at + inp.text.length) * 0.05,
            character_start_index: at,
            character_end_index: at + inp.text.length,
            dialogue_input_index: idx,
          };
          at += inp.text.length + 1;
          return seg;
        });
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({
            audio_base64: pcmBase64(chars.length * 0.05),
            alignment: {
              characters: chars,
              character_start_times_seconds: chars.map((_, i) => i * 0.05),
              character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.045),
            },
            voice_segments: segments,
          }),
        );
      }
      if (req.url!.startsWith("/v2/voices")) {
        res.writeHead(200, { "content-type": "application/json" });
        return res.end(
          JSON.stringify({
            voices: [
              { voice_id: PERSONA_VOICE, name: "George", category: "premade", labels: { gender: "male", age: "middle_aged", accent: "british", descriptive: "warm" }, preview_url: "https://example.com/george.mp3" },
              { voice_id: OWL_VOICE, name: "Bill", category: "premade", labels: { gender: "male", age: "old", accent: "american" } },
              { voice_id: "customMouse123", name: "Squeaky Mouse", category: "generated", labels: {}, description: "tiny squeaky mouse" },
            ],
            has_more: false,
            total_count: 3,
          }),
        );
      }
      res.writeHead(404).end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
  process.env.ANTHROPIC_BASE_URL = base;
  process.env.ELEVENLABS_API_KEY = "test-eleven";
  process.env.ELEVENLABS_BASE_URL = base;
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "storyhollow-test-"));
  delete process.env.DEMO_MODE;
});

after(() => server.close());

test("the storyteller sends pictures, settings and the voice catalog, and reads the streamed script", async () => {
  const { writeScript } = await import("@/lib/server/storyteller");
  const { defaultSettings } = await import("@/lib/shared/options");
  const { voiceCatalog } = await import("@/lib/server/voices");

  const voices = await voiceCatalog("household-1");
  assert.ok(voices.find((v) => v.voiceId === PERSONA_VOICE)?.persona, "personas are matched to account voices");
  assert.equal(voices.find((v) => v.voiceId === "customMouse123")?.source, "account");
  assert.equal(voices.find((v) => v.voiceId === PERSONA_VOICE)?.previewUrl, "https://example.com/george.mp3");

  scriptJson = JSON.stringify({
    title: "The Owl Who Borrowed the Moon",
    synopsis: "Ollie borrows the moon for one night.",
    ambience: "soft crickets",
    cast: [
      { id: "narrator", name: "Narrator", description: "storyteller", voice_brief: "warm", voice_id: PERSONA_VOICE },
      { id: "Ollie Owl", name: "Ollie the Owl", description: "a wise owl", voice_brief: "old and creaky", voice_id: OWL_VOICE },
    ],
    pages: [
      { page: 1, photo: 1, picture: "An owl on a tree", lines: [{ speaker: "narrator", text: "High in the old oak sat Ollie." }, { speaker: "ollie-owl", text: "[sleepily] Hoo..." }] },
      { page: 2, photo: 2, picture: "A fox", lines: [{ speaker: "mystery-guest", text: "Who goes there?" }] },
      { page: 3, photo: 3, picture: "extra page the model shouldn't have added", lines: [] },
    ],
  });

  const progress: string[] = [];
  const tinyJpeg = Buffer.from("/9j/4AAQSkZJRgABAQ==", "base64").toString("base64");
  const { script, photoOrder } = await writeScript(
    {
      mode: "create",
      bookTitle: "The Moonlit Woods",
      bookKind: "shadow_book",
      settings: defaultSettings({ heroes: ["Mia"], mood: "silly", lesson: "Sharing" }),
      images: [
        { data: tinyJpeg, mediaType: "image/jpeg" },
        { data: tinyJpeg, mediaType: "image/jpeg" },
      ],
      pageCount: 2,
      previousStories: [{ title: "Old Tale", synopsis: "Something that happened before." }],
      rememberedCharacters: [{ name: "Ollie the Owl", description: "wise owl", voiceId: OWL_VOICE }],
      voices,
    },
    (step, done, total) => progress.push(`${step} ${done}/${total}`),
  );

  const req = captured.find((c) => c.url.startsWith("/v1/messages"))!;
  assert.ok(req, "Claude was called");
  const body = req.body as Record<string, any>;
  assert.equal(body.model, "claude-opus-5-5");
  assert.equal(body.fallbacks, "default");
  assert.match(String(req.headers["anthropic-beta"]), /server-side-fallback-2026-07-01/);
  assert.equal(req.headers["x-api-key"], "test-key");
  assert.equal(body.stream, true);
  assert.deepEqual(body.thinking, { type: "adaptive" });
  assert.equal(body.output_config.effort, "high");
  assert.equal(body.output_config.format.type, "json_schema");
  const voiceEnum = body.output_config.format.schema.properties.cast.items.properties.voice_id.enum;
  assert.ok(voiceEnum.includes(PERSONA_VOICE) && voiceEnum.includes("customMouse123"));
  const content = body.messages[0].content as { type: string; text?: string }[];
  assert.equal(content.filter((c) => c.type === "image").length, 2);
  const ask = content.at(-1)!.text!;
  for (const expected of ["exactly 2 pages", "Mia", "Sharing", "Old Tale", "Ollie the Owl", "<voice_catalog>", "Silly & giggly", "Page order", "keep those names"]) {
    assert.ok(ask.includes(expected), `prompt mentions ${expected}`);
  }

  assert.equal(photoOrder, null, "no reordering when the pages were already in order");
  assert.equal(script.title, "The Owl Who Borrowed the Moon");
  assert.equal(script.pages.length, 2, "pages line up with the pictures");
  assert.equal(script.cast[1].id, "ollie-owl", "speaker ids are slugged");
  assert.equal(script.pages[0].lines[1].speaker, "ollie-owl");
  assert.equal(script.pages[1].lines[0].speaker, "narrator", "unknown speakers fall back to the narrator");
  assert.ok(progress.some((p) => p.startsWith("Writing the pages")));
});

test("the performer sends a multi-voice dialogue and returns PCM with word timings", async () => {
  const { performLines } = await import("@/lib/server/performer");
  const cast = [
    { id: "narrator", name: "Narrator", description: "", voiceBrief: "", voiceId: PERSONA_VOICE },
    { id: "ollie-owl", name: "Ollie", description: "", voiceBrief: "", voiceId: OWL_VOICE },
  ];
  const clip = await performLines(
    [
      { speaker: "narrator", text: "High in the old oak sat Ollie." },
      { speaker: "ollie-owl", text: "[sleepily] Hoo... who's there?" },
    ],
    cast,
  );
  const req = captured.find((c) => c.url.startsWith("/v1/text-to-dialogue/with-timestamps"))!;
  assert.ok(req, "ElevenLabs dialogue was called");
  assert.match(req.url, /output_format=pcm_24000/);
  assert.equal(req.headers["xi-api-key"], "test-eleven");
  const body = req.body as { inputs: { text: string; voice_id: string }[]; model_id: string };
  assert.equal(body.model_id, "eleven_v4");
  assert.deepEqual(body.inputs.map((i) => i.voice_id), [PERSONA_VOICE, OWL_VOICE]);
  assert.equal(body.inputs[1].text, "[sleepily] Hoo... who's there?", "delivery tags are sent to the voice model");

  assert.ok(clip.samples.length > 24000, "audio decoded");
  assert.deepEqual(
    clip.words.map((w) => w.w),
    ["High", "in", "the", "old", "oak", "sat", "Ollie.", "Hoo...", "who's", "there?"],
  );
  assert.equal(clip.words[0].speaker, "narrator");
  assert.equal(clip.words.at(-1)!.speaker, "ollie-owl");
});

test("pages photographed back to front are put back in reading order", async () => {
  const { writeScript, photoOrderFrom } = await import("@/lib/server/storyteller");
  const { defaultSettings } = await import("@/lib/shared/options");
  const { applyPhotoOrder } = await import("@/lib/server/jobs");
  const db = await import("@/lib/server/db");

  const page = (n: number, photo: number) => ({ page: n, photo, picture: `page ${n}`, lines: [{ speaker: "narrator", text: `Page ${n}.` }] });
  scriptJson = JSON.stringify({
    title: "Back to Front",
    synopsis: "A test.",
    ambience: "wind",
    cast: [{ id: "narrator", name: "Narrator", description: "", voice_brief: "", voice_id: PERSONA_VOICE }],
    pages: [page(1, 3), page(2, 2), page(3, 1)],
  });
  const img = { data: Buffer.from("x").toString("base64"), mediaType: "image/jpeg" as const };
  const req = {
    mode: "create" as const,
    bookTitle: "Halloween",
    bookKind: "shadow_book" as const,
    settings: defaultSettings({ keepNames: false }),
    images: [img, img, img],
    pageCount: 3,
    previousStories: [],
    rememberedCharacters: [],
    voices: [{ voiceId: PERSONA_VOICE, name: "George", description: "", gender: null, age: null, accent: null, previewUrl: null, persona: null, source: "default" as const }],
  };
  const { photoOrder } = await writeScript(req, () => undefined);
  assert.deepEqual(photoOrder, [3, 2, 1]);
  const ask = (captured.filter((c) => c.url.startsWith("/v1/messages")).at(-1)!.body as any).messages[0].content.at(-1).text as string;
  assert.ok(ask.includes("give the characters fresh new names"));

  // Only complete, one-to-one orders are trusted.
  const raw = (order: number[]) => ({ title: "", synopsis: "", ambience: "", cast: [], pages: order.map((o, i) => page(i + 1, o)) });
  assert.equal(photoOrderFrom(raw([1, 1, 2]), req), null);
  assert.equal(photoOrderFrom(raw([1, 2, 4]), req), null);
  assert.equal(photoOrderFrom(raw([1, 2]), req), null);
  assert.equal(photoOrderFrom(raw([2, 1, 3]), { ...req, settings: defaultSettings({ source: "wild" }) }), null);

  // Applying it reorders the book and moves the cover to the real first page.
  const hid = db.createHousehold("Test", `t${Date.now()}@example.com`, "x");
  const bookId = db.createBook(hid, { title: "Halloween", kind: "shadow_book" });
  db.replacePages(bookId, ["books/p8.jpg", "books/p7.jpg", "books/p6.jpg"]);
  db.updateBook(hid, bookId, { coverPath: "books/p8.jpg" });
  const sent = db.listPageRows(bookId);
  applyPhotoOrder(hid, bookId, sent, [3, 2, 1]);
  assert.deepEqual(db.listPageRows(bookId).map((r) => r.image_path), ["books/p6.jpg", "books/p7.jpg", "books/p8.jpg"]);
  assert.equal(db.getBook(hid, bookId)!.coverUrl, "/api/files/books/p6.jpg");

  // If the pages changed meanwhile, leave them alone.
  applyPhotoOrder(hid, bookId, sent, [3, 2, 1]);
  assert.deepEqual(db.listPageRows(bookId).map((r) => r.image_path), ["books/p6.jpg", "books/p7.jpg", "books/p8.jpg"]);
});

test("sign-ups close after the first family unless a sign-up code is set", async () => {
  const { signupMode, codeMatches } = await import("@/lib/server/signup");
  // Earlier tests created a household, so without a code the doors are closed.
  delete process.env.SIGNUP_CODE;
  assert.equal(signupMode(), "closed");
  process.env.SIGNUP_CODE = "moonlight";
  assert.equal(signupMode(), "code");
  assert.ok(codeMatches(" moonlight "));
  assert.ok(!codeMatches("moon"));
  assert.ok(!codeMatches(""));
  delete process.env.SIGNUP_CODE;
});
