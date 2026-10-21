import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { config } from "./config";
import {
  fileUrl,
  getBook,
  getStoryById,
  listBookCharacters,
  listPageRows,
  previousStoriesForBook,
  rememberCharacters,
  replacePages,
  updateBook,
  updateStory,
  type PageRow,
} from "./db";
import { readImageForModel, storyDir } from "./files";
import { castableVoices, voiceCatalog } from "./voices";
import { spotSoundEffects, writeScript, StorytellerError, type StoryRequest } from "./storyteller";
import { demoSoundCues, writeDemoScript } from "./demo-storyteller";
import { performAmbience, performLines, performSoundEffect, PerformerError } from "./performer";
import { encodeMp3, floatToPcm16, mixStory, pcm16ToFloat, type Clip, type PlacedEffect } from "./audio";
import { loadClassic } from "./classics";
import { forgetVoiceCredits } from "./credits";
import { sectionText, stripTags } from "./text";
import { personaFor } from "@/lib/shared/personas";
import type { ScriptLine, ScriptPage, SoundCue, StoryScript } from "@/lib/shared/types";

// Stories are written and recorded in the background so a phone can lock, or
// a parent can wander off to brush teeth, without losing anything. Progress
// lives in the database; the page polls it.

const globalForJobs = globalThis as unknown as { __storyhollowJobs?: Set<string> };
const running = (globalForJobs.__storyhollowJobs ??= new Set());

export function isRunning(storyId: string): boolean {
  return running.has(storyId);
}

/** Run a job in the background. It may return a follow-up job to start once it has finished. */
function launch(key: string, storyId: string, fn: () => Promise<(() => void) | void>) {
  if (running.has(storyId)) return;
  running.add(storyId);
  let next: (() => void) | void;
  fn()
    .then((followUp) => {
      next = followUp;
    })
    .catch((err) => {
      console.error(`[${key}] ${storyId}`, err);
      const friendly =
        err instanceof StorytellerError || err instanceof PerformerError || (err instanceof Error && err.name === "ClassicsError")
          ? err.message
          : "Something went wrong. Please try again.";
      updateStory(storyId, { status: "error", error: friendly, progress: null });
    })
    .finally(() => {
      running.delete(storyId);
      next?.();
    });
}

// -------------------------------------------------------------- writing

export function startWriting(storyId: string) {
  updateStory(storyId, { status: "writing", error: null, progress: { step: "Opening the book", done: 0, total: 1 } });
  launch("write", storyId, () => writeStory(storyId));
}

function pageCountFor(source: string, length: string, photos: number): number {
  const byLength = length === "short" ? 4 : length === "long" ? 9 : 6;
  if (source === "wild") return Math.max(Math.min(photos, 12), byLength);
  return byLength;
}

async function writeStory(storyId: string): Promise<(() => void) | void> {
  const story = getStoryById(storyId);
  if (!story) return;
  const book = getBook(story.householdId, story.bookId);
  if (!book) throw new Error("Book is missing");
  const s = story.settings;
  const progress = (step: string, done: number, total: number) =>
    updateStory(storyId, { progress: { step, done, total } });

  const voices = castableVoices(await voiceCatalog(story.householdId), s.narratorVoiceId);
  const narratorVoice = s.narratorVoiceId ?? voices.find((v) => v.persona)?.voiceId ?? voices[0]?.voiceId ?? "";

  // Text to read aloud, for classics and pasted words.
  let text: string | undefined;
  if (s.source === "classic" && s.classic) {
    progress("Fetching the book from the library", 0, 1);
    const classic = await loadClassic(s.classic.gutenbergId);
    const chapter = classic.chapters[s.classic.chapter];
    if (!chapter) throw new StorytellerError("That chapter couldn't be found.");
    text = chapter.text;
  } else if (s.source === "text") {
    text = s.text ?? "";
  }

  let script: StoryScript;
  if (text !== undefined && !s.fullCast) {
    // One reader, exact words: no storyteller needed, so it's instant and free.
    const sections = sectionText(text, 900);
    script = {
      title: story.title,
      synopsis:
        story.synopsis ??
        `Read aloud by ${personaFor(narratorVoice)?.name ?? voices.find((v) => v.voiceId === narratorVoice)?.name ?? "a storyteller"}.`,
      ambience: "a quiet room with a softly crackling fire",
      cast: [{ id: "narrator", name: "Reader", description: "The reader", voiceBrief: "warm and clear", voiceId: narratorVoice }],
      pages: sections.map((t, i) => ({ page: i + 1, picture: "", lines: [{ speaker: "narrator", text: t }] })),
    };
  } else {
    const pageRows = s.source === "idea" || text !== undefined ? [] : listPageRows(book.id);
    const images = await Promise.all(pageRows.map((p) => readImageForModel(story.householdId, p.image_path)));
    const pageCount =
      s.source === "book" || s.source === "book_read" ? images.length : pageCountFor(s.source, s.length, images.length);
    if ((s.source === "book" || s.source === "book_read") && pageCount === 0) {
      throw new StorytellerError("This book has no page photos yet. Add some pictures first.");
    }
    const req: StoryRequest = {
      mode: story.mode,
      bookTitle: book.title,
      bookKind: book.kind,
      settings: { ...s, narratorVoiceId: s.narratorVoiceId },
      images,
      pageCount,
      text,
      previousStories: previousStoriesForBook(book.id, story.id),
      rememberedCharacters: listBookCharacters(book.id),
      voices,
    };
    const written =
      config.anthropicKey || !config.demoMode ? await writeScript(req, progress) : await writeDemoScript(req, progress);
    script = written.script;
    if (written.photoOrder) applyPhotoOrder(story.householdId, book.id, pageRows, written.photoOrder);
    if (story.mode === "read") script.title = story.title || script.title;
  }

  updateStory(storyId, {
    script,
    title: script.title,
    synopsis: script.synopsis,
    status: "draft",
    progress: null,
  });

  if (!s.review) return () => startRecording(storyId);
}

/**
 * The storyteller spotted that the photos were out of order (often a book
 * photographed back to front): put the book's pages in reading order so the
 * player, the studio and every future story show the right picture.
 */
export function applyPhotoOrder(householdId: string, bookId: string, sent: PageRow[], order: number[]) {
  const current = listPageRows(bookId);
  // Only if nobody changed the pages while the story was being written.
  if (current.length !== sent.length || current.some((r, i) => r.image_path !== sent[i].image_path)) return;
  const paths = order.map((n) => sent[n - 1].image_path);
  replacePages(bookId, paths);
  const book = getBook(householdId, bookId);
  if (book && book.coverUrl === fileUrl(sent[0].image_path)) updateBook(householdId, bookId, { coverPath: paths[0] });
}

// ------------------------------------------------------------ recording

export function startRecording(storyId: string) {
  const step = getStoryById(storyId)?.audioUrl ? "Opening the recordings" : "Warming up the voices";
  updateStory(storyId, { status: "recording", error: null, progress: { step, done: 0, total: 1 } });
  launch("record", storyId, () => recordStory(storyId));
}

function introLines(
  script: StoryScript,
  opts: { chime: boolean; mode: string; source: string; bookTitle: string },
): { before: ScriptLine[]; after: ScriptLine[] } {
  const narrator = script.cast.find((c) => c.id === "narrator");
  const persona = narrator ? personaFor(narrator.voiceId) : undefined;
  const chapter = stripTags(script.title);
  // A chapter of a classic is introduced with its book: "The Wind in the Willows: The River Bank".
  const title = opts.mode === "read" && opts.bookTitle && chapter !== opts.bookTitle ? `${opts.bookTitle}: ${chapter}` : chapter;
  const readBy = opts.mode === "read" && persona ? `, read for you by ${persona.name}` : "";
  const bookish = opts.source === "book" || opts.source === "book_read";
  if (opts.chime && bookish) {
    return {
      before: [
        {
          speaker: "narrator",
          text: `[warmly] Welcome to Storyhollow. Tonight's story is called ${title}${readBy}. You can follow along with the pictures in your book. You'll know it's time to turn the page when you hear this sound...`,
        },
      ],
      after: [{ speaker: "narrator", text: "That's the one! Now, open your book to the very first page... and let's begin." }],
    };
  }
  return {
    before: [
      {
        speaker: "narrator",
        text: `[warmly] Welcome to Storyhollow. Tonight's story is called ${title}${readBy}. So snuggle in... and let's begin.`,
      },
    ],
    after: [],
  };
}

function hashOf(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex").slice(0, 16);
}

interface CachedClip {
  hash: string;
  words: Clip["words"];
}

/** Record a set of lines, reusing the saved audio if nothing changed. */
async function cachedPerformance(dir: string, name: string, lines: ScriptLine[], script: StoryScript): Promise<Clip> {
  const voices = Object.fromEntries(script.cast.map((c) => [c.id, c.voiceId]));
  const hash = hashOf({ lines, voices: lines.map((l) => voices[l.speaker]), model: config.voiceModel, demo: !config.elevenLabsKey });
  const pcmPath = path.join(dir, `${name}.pcm`);
  const metaPath = path.join(dir, `${name}.json`);
  try {
    const meta = JSON.parse(await fs.promises.readFile(metaPath, "utf8")) as CachedClip;
    if (meta.hash === hash) return { samples: pcm16ToFloat(await fs.promises.readFile(pcmPath)), words: meta.words };
  } catch {
    // not recorded yet
  }
  const clip = await performLines(lines, script.cast);
  await fs.promises.writeFile(pcmPath, floatToPcm16(clip.samples));
  await fs.promises.writeFile(metaPath, JSON.stringify({ hash, words: clip.words } satisfies CachedClip));
  return clip;
}

async function recordStory(storyId: string) {
  const story = getStoryById(storyId);
  if (!story?.script) throw new Error("Nothing to record yet");
  const { script, settings } = story;
  const dir = storyDir(story.householdId, storyId);
  await fs.promises.mkdir(dir, { recursive: true });

  const steps = script.pages.length + (settings.intro ? 1 : 0) + (settings.ambience ? 1 : 0) + (settings.effects ? 1 : 0) + 1;
  let done = 0;
  const tick = (step: string) => updateStory(storyId, { progress: { step, done: done++, total: steps } });

  let intro: { before: Clip; after: Clip } | null = null;
  if (settings.intro) {
    tick("Recording the welcome");
    const bookTitle = getBook(story.householdId, story.bookId)?.title ?? "";
    const lines = introLines(script, { chime: settings.chime.enabled, mode: story.mode, source: settings.source, bookTitle });
    intro = {
      before: await cachedPerformance(dir, "intro-a", lines.before, script),
      after: await cachedPerformance(dir, "intro-b", lines.after, script),
    };
  }

  // Two pages at a time keeps things quick without tripping rate limits.
  const pages: { page: number; clip: Clip }[] = new Array(script.pages.length);
  let next = 0;
  const worker = async () => {
    while (next < script.pages.length) {
      const i = next++;
      const p = script.pages[i];
      tick(`Recording page ${p.page} of ${script.pages.length}`);
      pages[i] = { page: p.page, clip: await cachedPerformance(dir, `page-${String(p.page).padStart(3, "0")}`, p.lines, script) };
    }
  };
  await Promise.all([worker(), worker()]);

  let ambience: Float32Array | null = null;
  if (settings.ambience && script.ambience) {
    tick("Painting the soundscape");
    ambience = await cachedAmbience(dir, script.ambience);
  }

  let effects: PlacedEffect[] = [];
  if (settings.effects) {
    tick("Adding the sound effects");
    // A story is still lovely without its sound effects, so a hiccup here never stops it.
    effects = await recordEffects(storyId, dir, script, pages).catch((err) => {
      console.warn("Sound effects unavailable:", err);
      return [];
    });
  }

  tick("Binding the story together");
  await finishMix(storyId, dir, { pages, intro, ambience, effects });

  if (story.mode === "create") {
    rememberCharacters(
      story.bookId,
      script.cast
        .filter((c) => c.id !== "narrator")
        .map((c) => ({ name: c.name, description: c.description || c.voiceBrief, voiceId: c.voiceId })),
    );
  }
}

async function cachedAmbience(dir: string, description: string): Promise<Float32Array | null> {
  const hash = hashOf({ description, demo: !config.elevenLabsKey });
  const pcmPath = path.join(dir, `ambience-${hash}.pcm`);
  try {
    return pcm16ToFloat(await fs.promises.readFile(pcmPath));
  } catch {
    const loop = await performAmbience(description);
    if (loop) await fs.promises.writeFile(pcmPath, floatToPcm16(loop));
    return loop;
  }
}

// ------------------------------------------------------------ sound effects

const tokens = (text: string) => text.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
const bare = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");

/**
 * When a cue's word is spoken, in seconds from the start of its page's
 * recording. Null when the word is no longer on the page (it was edited).
 */
export function cueTime(page: ScriptPage, clip: Clip, cue: SoundCue): number | null {
  const counts = page.lines.map((l) => tokens(l.text).length);
  const lineStart = counts.slice(0, cue.line).reduce((n, c) => n + c, 0);
  const inLine = tokens(page.lines[cue.line]?.text ?? "").findIndex((w) => bare(w) === bare(cue.word));
  const onPage = inLine >= 0 ? lineStart + inLine : page.lines.flatMap((l) => tokens(l.text)).findIndex((w) => bare(w) === bare(cue.word));
  if (onPage < 0) return null;
  if (!clip.words.length) return 0;
  // Spoken words can drift a little from the written ones; take the nearest match.
  let at = Math.min(onPage, clip.words.length - 1);
  for (let d = 0; d <= 8; d++) {
    const k = [onPage - d, onPage + d].find((i) => clip.words[i] && bare(clip.words[i].w) === bare(cue.word));
    if (k !== undefined) {
      at = k;
      break;
    }
  }
  return Math.max(0, clip.words[at].t - 0.05);
}

const effectFile = (dir: string, cue: SoundCue) =>
  path.join(dir, `sfx-${hashOf({ sound: cue.sound, seconds: cue.seconds, demo: !config.elevenLabsKey })}.pcm`);

/** Choose the sound effects (once per script), make any not yet made, and place them. */
async function recordEffects(storyId: string, dir: string, script: StoryScript, pages: { page: number; clip: Clip }[]): Promise<PlacedEffect[]> {
  if (!script.effects) {
    script.effects = config.anthropicKey || !config.demoMode ? await spotSoundEffects(script) : demoSoundCues(script);
    updateStory(storyId, { script });
  }
  const placed: PlacedEffect[] = [];
  for (const cue of script.effects) {
    const i = script.pages.findIndex((p) => p.page === cue.page);
    const at = i >= 0 ? cueTime(script.pages[i], pages[i].clip, cue) : null;
    if (at === null) continue;
    const file = effectFile(dir, cue);
    let samples: Float32Array;
    try {
      samples = pcm16ToFloat(await fs.promises.readFile(file));
    } catch {
      samples = await performSoundEffect(cue.sound, cue.seconds);
      await fs.promises.writeFile(file, floatToPcm16(samples));
    }
    placed.push({ page: cue.page, at, samples });
  }
  return placed;
}

async function finishMix(
  storyId: string,
  dir: string,
  parts: { pages: { page: number; clip: Clip }[]; intro: { before: Clip; after: Clip } | null; ambience: Float32Array | null; effects: PlacedEffect[] },
) {
  const story = getStoryById(storyId)!;
  const { samples, timeline } = mixStory({ ...parts, chime: story.settings.chime });
  const mp3 = encodeMp3(samples);
  await fs.promises.writeFile(path.join(dir, "story.mp3"), mp3);
  forgetVoiceCredits(); // the recording used some: the next look at the balance asks again
  updateStory(storyId, {
    status: "ready",
    progress: null,
    error: null,
    audioPath: `stories/${storyId}/story.mp3`,
    timeline,
    duration: timeline.duration,
  });
}

/**
 * Re-bind an already-recorded story with new chime or pause settings. Uses
 * the saved recordings, so it costs no voice credits.
 */
export async function remixStory(storyId: string): Promise<boolean> {
  const story = getStoryById(storyId);
  if (!story?.script) return false;
  const dir = storyDir(story.householdId, storyId);
  const load = async (name: string): Promise<Clip | null> => {
    try {
      const meta = JSON.parse(await fs.promises.readFile(path.join(dir, `${name}.json`), "utf8")) as CachedClip;
      return { samples: pcm16ToFloat(await fs.promises.readFile(path.join(dir, `${name}.pcm`))), words: meta.words };
    } catch {
      return null;
    }
  };
  const pages: { page: number; clip: Clip }[] = [];
  for (const p of story.script.pages) {
    const clip = await load(`page-${String(p.page).padStart(3, "0")}`);
    if (!clip) return false;
    pages.push({ page: p.page, clip });
  }
  let intro: { before: Clip; after: Clip } | null = null;
  if (story.settings.intro) {
    const before = await load("intro-a");
    const after = await load("intro-b");
    if (!before || !after) return false;
    intro = { before, after };
  }
  let ambience: Float32Array | null = null;
  if (story.settings.ambience && story.script.ambience) {
    try {
      ambience = pcm16ToFloat(
        await fs.promises.readFile(path.join(dir, `ambience-${hashOf({ description: story.script.ambience, demo: !config.elevenLabsKey })}.pcm`)),
      );
    } catch {
      return false;
    }
  }
  const effects: PlacedEffect[] = [];
  if (story.settings.effects) {
    if (!story.script.effects) return false;
    for (const cue of story.script.effects) {
      const i = story.script.pages.findIndex((p) => p.page === cue.page);
      const at = i >= 0 ? cueTime(story.script.pages[i], pages[i].clip, cue) : null;
      if (at === null) continue;
      try {
        effects.push({ page: cue.page, at, samples: pcm16ToFloat(await fs.promises.readFile(effectFile(dir, cue))) });
      } catch {
        return false;
      }
    }
  }
  await finishMix(storyId, dir, { pages, intro, ambience, effects });
  return true;
}
