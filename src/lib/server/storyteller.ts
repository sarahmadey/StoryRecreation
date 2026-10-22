import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { config } from "./config";
import { describeVoiceForCasting } from "./voices";
import { AGES, BOOK_KINDS, LENGTHS, MOODS, WORDS_PER_MINUTE, wordsPerPage } from "@/lib/shared/options";
import type { BookKind, SoundCue, StoryScript, StorySettings, VoiceOption } from "@/lib/shared/types";
import type { RememberedCharacter } from "./db";

// --------------------------------------------------------------------------
// The storyteller's craft. These prompts are the heart of the app: they turn
// photos of a book's pages into a fresh, performable audio-drama script.
// --------------------------------------------------------------------------

const PERFORMANCE_RULES = `The cast
- Always include a narrator with id "narrator". Add a speaking role for each character who talks (at most 6 besides the narrator). Character ids are short lowercase slugs like "ollie-owl".
- "voice_brief" describes how the character should sound in one line: age, timbre, pace, accent, personality.
- Choose every "voice_id" from the voice catalog. Match age, gender, timbre and personality to the character. Characters who talk to each other need clearly different voices, and no character may share the narrator's voice. When a character has a remembered voice, reuse it exactly.

Performing
- Every line is spoken by one cast member, named in "speaker" by cast id. Narration goes to the narrator. Dialogue goes to the character who says it, without quotation marks.
- You may start a line (or a phrase inside one) with a delivery tag in square brackets when it truly helps the performance: [whispers], [softly], [excitedly], [giggles], [laughs], [gasps], [sighs], [yawns], [sleepily], [curious], [surprised], [nervously], [proudly], [mischievously], [sadly], [warmly]. At most one tag per line, and not on most lines. Never use tags for sound effects or music.
- Use punctuation for pacing: an ellipsis for a pause, an em dash for an interruption, exclamation marks sparingly. Spell out numbers. No emoji, symbols, stage directions or headings in spoken text.`;

const CREATE_SYSTEM = `You are the Storyteller of Storyhollow: an award-winning children's author and audio-drama director. You write brand-new stories that are performed by a cast of expressive, human-sounding voices and heard by young children, very often at bedtime.

How these stories are heard
- A child listens while looking at real pictures: the pages of a book in their lap, a shadow book projected on the bedroom wall, or photos from their own day. Each page of narration must match the picture they are looking at right now. Point to what is visible so they can find it ("Can you spot the little owl at the very top of the tree?"). Never describe something that only appears on a later page.
- When a page ends, a chime tells the child to turn the page. End each page at a natural resting point, often with a small hook that makes them eager to turn it.
- Write for the ear: musical rhythm, varied sentence length, refrains young children can join in with, delicious sound words, and dialogue that makes every character instantly recognizable. Leave room to breathe.

Shadow books
- Shadow book pages are silhouettes: cut-out shapes cast as shadows on a wall. Read the shapes generously and imaginatively, stay consistent from page to page, and feel free to play with light, dark and shadow in the story itself.

Fresh stories only
- Book photos often show the original printed text. You may read it to understand who the characters are and what is happening in each picture, but never reuse or paraphrase its wording or its plot: the family wants a completely new story for the same pictures. Keep the characters you can see and give them brand-new adventures; follow the family's wishes about names. Ignore page numbers and notes printed for readers (such as "scan the QR code").
- Keep it modern, warm and inclusive. No outdated stereotypes, no gender clichés, no meanness that goes unresolved, nothing frightening beyond the requested mood. Everyone is safe and loved at the end.

${PERFORMANCE_RULES}

Shape
- A title that would look lovely on a book spine, and a one- or two-sentence synopsis for the library card.
- "ambience": a short description of a gentle, seamlessly looping background soundscape that suits the setting, such as "soft night crickets and a faint breeze in the pines". No music, no voices, nothing sudden.
- Return exactly the pages requested, in reading order. "picture" is a short note of what you see in that page's picture (or what the page is about when there is no picture).`;

const READ_SYSTEM = `You are the Reader of Storyhollow. You prepare a faithful read-aloud performance script of a real book, performed by expressive, human-sounding voices for a child who is following along.

Faithfulness comes first
- Use the story text exactly as written, in reading order. Never rewrite, simplify, add to, or skip story words. Only rejoin words broken across lines by hyphenation.
- Leave out page numbers, running headers, publisher details, copyright notices and barcodes.
- If a page has no story text, return it with an empty "lines" list (the child still gets the page-turn chime).

${PERFORMANCE_RULES}
- For a faithful reading, only add a delivery tag where the text itself says how something is said (for example "she whispered"), and keep the text itself unchanged.
- Dialogue tags such as "said the bear" stay in the narrator's lines, word for word.

Shape
- "title": the book's title. "synopsis": one warm sentence describing the book. "ambience": a gentle looping background soundscape that suits it.`;

// ----------------------------------------------------------------- schema

const LineSchema = z.object({ speaker: z.string(), text: z.string() });
const ScriptSchema = z.object({
  title: z.string(),
  synopsis: z.string(),
  ambience: z.string(),
  cast: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      voice_brief: z.string(),
      voice_id: z.string(),
    }),
  ),
  pages: z.array(z.object({ page: z.number().int(), photo: z.number().int(), picture: z.string(), lines: z.array(LineSchema) })),
});
type RawScript = z.infer<typeof ScriptSchema>;

function jsonSchema(voiceIds: string[]) {
  const str = { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "synopsis", "ambience", "cast", "pages"],
    properties: {
      title: str,
      synopsis: str,
      ambience: str,
      cast: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "description", "voice_brief", "voice_id"],
          properties: {
            id: str,
            name: str,
            description: str,
            voice_brief: str,
            voice_id: voiceIds.length ? { type: "string", enum: voiceIds } : str,
          },
        },
      },
      pages: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["page", "photo", "picture", "lines"],
          properties: {
            page: { type: "integer" },
            photo: { type: "integer" },
            picture: str,
            lines: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["speaker", "text"],
                properties: { speaker: str, text: str },
              },
            },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------- request

export interface StoryImage {
  data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

export interface StoryRequest {
  mode: "create" | "read";
  bookTitle: string;
  bookKind: BookKind;
  settings: StorySettings;
  images: StoryImage[];
  /** How many pages to write. For books, one per photo. */
  pageCount: number;
  /** For read-aloud of text (classics, pasted words). */
  text?: string;
  previousStories: { title: string; synopsis: string }[];
  rememberedCharacters: RememberedCharacter[];
  voices: VoiceOption[];
}

const PAGE_ORDER = `Page order: the photos are numbered in the order the family took them, which is not always the book's order (people often photograph a book back to front). If the pages show printed page numbers, or the pictures or text clearly run in another order, return the pages in the book's true reading order. For every page, set "photo" to the number of the photo that belongs on it; when the order is already right, "photo" simply equals "page".`;

function requestText(req: StoryRequest): string {
  const s = req.settings;
  const kind = BOOK_KINDS[req.bookKind].label.toLowerCase();
  const parts: string[] = [];

  if (req.mode === "create") {
    const wpp = wordsPerPage(s.length, req.pageCount);
    const minutes = Math.round((wpp * req.pageCount) / WORDS_PER_MINUTE);
    parts.push(`Write a brand-new story.`);
    parts.push(`Book: "${req.bookTitle}" (${kind}).`);
    if (s.source === "book") {
      parts.push(`There are ${req.pageCount} pictures above, one per page. Write exactly ${req.pageCount} pages, page 1 to ${req.pageCount}, each matching its picture.`);
      parts.push(PAGE_ORDER);
      parts.push(
        s.keepNames !== false
          ? `Names: if the book's printed text names the characters, keep those names. The children know these friends, and tonight they get a brand-new adventure.`
          : `Names: give the characters fresh new names.`,
      );
    } else if (s.source === "wild") {
      parts.push(
        `The photos above were taken by the family out in the world. Let them inspire a story of exactly ${req.pageCount} pages; follow the photos in order, and several pages may share one photo. The child may be looking at the photos while listening. Set "photo" to the number of the photo that inspired each page.`,
      );
    } else {
      parts.push(`Write exactly ${req.pageCount} pages. There are no pictures, so paint each scene vividly with words. Set "photo" to 0.`);
    }
    if (s.description.trim()) parts.push(`What the family told us about it: ${s.description.trim()}`);
    parts.push(`Mood: ${MOODS[s.mood].label}. ${MOODS[s.mood].direction}`);
    parts.push(`Listener: ${AGES[s.age].label}. ${AGES[s.age].guidance}`);
    parts.push(
      `Length: ${LENGTHS[s.length].label}. Aim for about ${wpp} spoken words per page, roughly ${minutes} minutes in all. Keep pages close to that length.`,
    );
    if (s.heroes.length) {
      parts.push(
        `Heroes: make ${s.heroes.join(" and ")} the heroes of the story, by name. They are children listening tonight, so they should be brave, kind and clever, and have a wonderful time.`,
      );
    }
    if (s.lesson.trim()) parts.push(`A gentle theme to weave in (never preachy): ${s.lesson.trim()}`);
    if (s.extra.trim()) parts.push(`Special wishes from the family: ${s.extra.trim()}`);
    if (s.surprise) {
      parts.push(
        `Surprise us: choose an unexpected angle, such as a different main character, a twist on the genre, or the story told from a surprising point of view.`,
      );
    }
    if (req.previousStories.length) {
      parts.push(
        `Stories already told for this book. Tonight's must be clearly different, with a new plot, a new main problem and a new twist:\n${req.previousStories
          .map((p) => `- "${p.title}": ${p.synopsis}`)
          .join("\n")}`,
      );
    }
  } else {
    parts.push(`Prepare a faithful read-aloud of "${req.bookTitle}".`);
    if (req.text) {
      parts.push(
        `The text is below. Split it into sections of roughly 120 to 200 words at natural paragraph breaks; each section is one "page" with "picture" left empty and "photo" set to 0. Keep every word.`,
      );
    } else {
      parts.push(`There are ${req.pageCount} page photos above. Return exactly ${req.pageCount} pages, page 1 to ${req.pageCount}.`);
      parts.push(PAGE_ORDER);
    }
  }

  parts.push(
    s.fullCast
      ? `Cast: a full cast, with a different voice for each speaking character.`
      : `Cast: the narrator performs everything, including the dialogue. Return only the narrator in "cast", and put dialogue in the narrator's lines.`,
  );
  if (s.narratorVoiceId) parts.push(`The narrator must use voice_id ${s.narratorVoiceId}.`);
  if (req.rememberedCharacters.length) {
    parts.push(
      `Remembered characters and their voices from earlier stories for this book (reuse the voice if the character appears):\n${req.rememberedCharacters
        .map((c) => `- ${c.name} (${c.description}): voice_id ${c.voiceId}`)
        .join("\n")}`,
    );
  }
  parts.push(`<voice_catalog>\n${req.voices.map(describeVoiceForCasting).join("\n")}\n</voice_catalog>`);
  if (req.text) parts.push(`<text>\n${req.text}\n</text>`);
  return parts.join("\n\n");
}

function buildContent(req: StoryRequest): Anthropic.Beta.BetaContentBlockParam[] {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  req.images.forEach((img, i) => {
    content.push({ type: "text", text: req.settings.source === "book" || req.mode === "read" ? `Page ${i + 1}:` : `Photo ${i + 1}:` });
    content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
  });
  content.push({ type: "text", text: requestText(req) });
  return content;
}

// --------------------------------------------------------------- generate

export interface WriteProgress {
  (step: string, done: number, total: number): void;
}

const globalForClaude = globalThis as unknown as { __anthropic?: Anthropic };
function anthropic(): Anthropic {
  globalForClaude.__anthropic ??= new Anthropic({ apiKey: config.anthropicKey });
  return globalForClaude.__anthropic;
}

export class StorytellerError extends Error {}

export interface WrittenStory {
  script: StoryScript;
  /** When the photos were out of order: which photo (1-based) belongs on each page, in reading order. */
  photoOrder: number[] | null;
}

export async function writeScript(req: StoryRequest, onProgress: WriteProgress): Promise<WrittenStory> {
  const voiceIds = [...new Set(req.voices.map((v) => v.voiceId))];
  onProgress(req.images.length ? "Studying the pictures" : "Dreaming up the story", 0, req.pageCount);

  const stream = anthropic().beta.messages.stream({
    model: config.storyModel,
    max_tokens: 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: {
      effort: req.mode === "create" ? "high" : "medium",
      format: { type: "json_schema", schema: jsonSchema(voiceIds) },
    },
    system: req.mode === "create" ? CREATE_SYSTEM : READ_SYSTEM,
    messages: [{ role: "user", content: buildContent(req) }],
  });

  // Count pages as they stream in so the family can watch the story grow.
  let text = "";
  let pagesSeen = 0;
  stream.on("text", (delta) => {
    text += delta;
    const seen = (text.match(/"picture"\s*:/g) ?? []).length;
    if (seen !== pagesSeen) {
      pagesSeen = seen;
      onProgress(req.mode === "create" ? "Writing the pages" : "Reading the pages", Math.min(seen, req.pageCount), req.pageCount);
    }
  });

  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new StorytellerError("The Anthropic API key was not accepted.");
    if (err instanceof Anthropic.RateLimitError) throw new StorytellerError("The storyteller is busy right now. Please try again in a minute.");
    if (err instanceof Anthropic.APIError) throw new StorytellerError(`The storyteller hit a snag (${err.status}). Please try again.`);
    throw err;
  }

  if (message.stop_reason === "refusal") {
    throw new StorytellerError("The storyteller couldn't write this one. Try different pictures or wishes.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new StorytellerError("That story grew too long to finish. Try a shorter length.");
  }
  const out = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let raw: RawScript;
  try {
    raw = ScriptSchema.parse(JSON.parse(out));
  } catch {
    throw new StorytellerError("The storyteller's pages got jumbled. Please try again.");
  }
  return { script: normalizeScript(raw, req), photoOrder: photoOrderFrom(raw, req) };
}

/**
 * If the storyteller found the photos out of order (say, photographed back to
 * front), the reading order of photos. Only trusted when it is a complete,
 * one-to-one reordering of every page photo.
 */
export function photoOrderFrom(raw: RawScript, req: StoryRequest): number[] | null {
  const bookish = req.settings.source === "book" || req.settings.source === "book_read";
  const n = req.images.length;
  if (!bookish || req.text || n < 2 || raw.pages.length !== n) return null;
  const order = raw.pages.map((p) => p.photo);
  const complete = order.every((x) => Number.isInteger(x) && x >= 1 && x <= n) && new Set(order).size === n;
  if (!complete) return null;
  return order.some((x, i) => x !== i + 1) ? order : null;
}

/** Make the script safe to perform: valid speakers, valid voices, pages in order. */
export function normalizeScript(raw: RawScript, req: StoryRequest): StoryScript {
  const voiceIds = new Set(req.voices.map((v) => v.voiceId));
  const fallbackVoice = req.settings.narratorVoiceId ?? req.voices[0]?.voiceId ?? "";

  const cast = raw.cast.map((c) => ({
    id: slug(c.id) || "narrator",
    name: c.name.trim() || "Narrator",
    description: c.description.trim(),
    voiceBrief: c.voice_brief.trim(),
    voiceId: voiceIds.has(c.voice_id) ? c.voice_id : fallbackVoice,
  }));
  if (!cast.some((c) => c.id === "narrator")) {
    cast.unshift({ id: "narrator", name: "Narrator", description: "The storyteller", voiceBrief: "warm and gentle", voiceId: fallbackVoice });
  }
  const narrator = cast.find((c) => c.id === "narrator")!;
  if (req.settings.narratorVoiceId) narrator.voiceId = req.settings.narratorVoiceId;

  // Keep remembered characters on their voices.
  for (const c of cast) {
    const remembered = req.rememberedCharacters.find((r) => r.name.toLowerCase() === c.name.toLowerCase());
    if (remembered && voiceIds.has(remembered.voiceId) && c.id !== "narrator") c.voiceId = remembered.voiceId;
  }

  const castIds = new Set(cast.map((c) => c.id));
  let pages = raw.pages.map((p, i) => ({
    page: i + 1,
    picture: p.picture.trim(),
    lines: p.lines
      .map((l) => ({ speaker: castIds.has(slug(l.speaker)) ? slug(l.speaker) : "narrator", text: l.text.trim() }))
      .filter((l) => l.text.length > 0),
  }));
  // Pages tied to real pictures must line up one-to-one with them.
  if (!req.text) {
    pages = pages.slice(0, req.pageCount);
    while (pages.length < req.pageCount) pages.push({ page: pages.length + 1, picture: "", lines: [] });
  }

  return {
    title: raw.title.trim() || req.bookTitle,
    synopsis: raw.synopsis.trim(),
    ambience: raw.ambience.trim(),
    cast: req.settings.fullCast ? cast : [narrator],
    pages: req.settings.fullCast ? pages : pages.map((p) => ({ ...p, lines: p.lines.map((l) => ({ ...l, speaker: "narrator" })) })),
  };
}

// ------------------------------------------------------------ sound effects

const SOUND_SYSTEM = `You are the sound designer for Storyhollow, a family audio-story app heard by young children, very often at bedtime. You are given a finished story script. Choose a few moments where one short, real-world sound effect would delight a child and make the story feel alive: a door creaking open just as the narrator says so, an owl's hoot, footsteps crunching through leaves, a splash, a knock, a cat's meow, a spoon clinking in a bowl.

- Few and well placed: about one for every two pages, never more than one on a page, and at most eight in all. Return fewer, or none, when nothing fits.
- Each sound lands on the word where it happens in the story ("creaked", "splash", "knocked"). Give the page, the line's index on that page (counting from 0), and that word copied exactly as it is written in the line.
- Short and gentle: one to four seconds, soft enough to sit beneath a voice. Describe the sound itself, concretely, for a sound-effects generator ("a small wooden door creaks slowly open"), never a mood.
- Never music, singing, voices or speech, crowds, a continuous background (rain, crickets, a wind that keeps blowing), alarms, screams, thunder, explosions, or anything loud, harsh or frightening.`;

const SOUND_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["effects"],
  properties: {
    effects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["page", "line", "word", "sound", "seconds"],
        properties: {
          page: { type: "integer" },
          line: { type: "integer" },
          word: { type: "string" },
          sound: { type: "string" },
          seconds: { type: "number" },
        },
      },
    },
  },
};
const SoundCuesSchema = z.object({
  effects: z.array(z.object({ page: z.number(), line: z.number(), word: z.string(), sound: z.string(), seconds: z.number() })),
});

/** Keep cues that point at a real line, at most one a page and eight in all. */
export function cleanSoundCues(script: StoryScript, cues: SoundCue[]): SoundCue[] {
  const used = new Set<number>();
  const out: SoundCue[] = [];
  for (const c of cues) {
    const page = script.pages.find((p) => p.page === c.page);
    const sound = c.sound.trim().slice(0, 200);
    if (!page || !page.lines[c.line] || !sound || used.has(c.page)) continue;
    used.add(c.page);
    out.push({ page: c.page, line: c.line, word: c.word.trim().slice(0, 40), sound, seconds: Math.min(4.5, Math.max(0.8, c.seconds || 2)) });
    if (out.length === 8) break;
  }
  return out.sort((a, b) => a.page - b.page);
}

/** Ask the sound designer where a few short effects belong in a finished script. */
export async function spotSoundEffects(script: StoryScript): Promise<SoundCue[]> {
  const cast = new Map(script.cast.map((c) => [c.id, c.name]));
  const pages = script.pages
    .map((p) => [`Page ${p.page}`, ...p.lines.map((l, i) => `  [${i}] ${cast.get(l.speaker) ?? l.speaker}: ${l.text}`)].join("\n"))
    .join("\n\n");
  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await anthropic().beta.messages.create({
      model: config.storyModel,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: SOUND_SCHEMA } },
      system: SOUND_SYSTEM,
      messages: [{ role: "user", content: `"${script.title}"\n\n${pages}` }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new StorytellerError("The Anthropic API key was not accepted.");
    if (err instanceof Anthropic.APIError) throw new StorytellerError(`The sound designer hit a snag (${err.status}). Please try again.`);
    throw err;
  }
  if (message.stop_reason !== "end_turn") throw new StorytellerError("The sound designer couldn't place sounds in this story.");
  const out = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return cleanSoundCues(script, SoundCuesSchema.parse(JSON.parse(out)).effects);
  } catch {
    throw new StorytellerError("The sound designer's notes got jumbled. Please try again.");
  }
}

// ---------------------------------------------------------- words in a picture

const WORDS_SYSTEM = `You copy out the words in photos and screenshots for Storyhollow, a family app that reads them aloud to children. The pictures might show a poem, a letter or card, a page from a book, a note, a story a child wrote, or a screenshot of any of these.

- Copy the words exactly as written: the same wording, spelling and punctuation. Don't correct, summarise, explain or add anything.
- Keep a poem's shape: each line on its own line, and a blank line between verses. Join prose lines into paragraphs, with a blank line between paragraphs.
- Several pictures are consecutive pages, in order: join them into one text.
- Leave out what isn't part of the piece itself: a screenshot's time, battery, buttons, menus, usernames, likes and timestamps; page numbers and running headers.
- Handwriting, a child's spelling or a faded page: give your best reading of what it says.
- If the piece has a title, give it separately and leave it out of the text. Otherwise leave the title empty.
- If there are no words to read, leave the text empty.`;

const WORDS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "text"],
  properties: { title: { type: "string" }, text: { type: "string" } },
} as const;

/** The words in photos or screenshots of a poem, letter or page, copied out exactly so they can be read aloud. */
export async function readWordsFromPictures(images: StoryImage[]): Promise<{ title: string | null; text: string }> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = images.flatMap((img, i) => [
    ...(images.length > 1 ? [{ type: "text" as const, text: `Picture ${i + 1}:` }] : []),
    { type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.data } },
  ]);
  content.push({ type: "text", text: images.length > 1 ? "Copy out the words in these pictures." : "Copy out the words in this picture." });
  let message: Anthropic.Beta.BetaMessage;
  try {
    message = await anthropic().beta.messages.create({
      model: config.storyModel,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: WORDS_SCHEMA } },
      system: WORDS_SYSTEM,
      messages: [{ role: "user", content }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new StorytellerError("The Anthropic API key was not accepted.");
    if (err instanceof Anthropic.RateLimitError) throw new StorytellerError("The storyteller is busy right now. Please try again in a minute.");
    if (err instanceof Anthropic.APIError) throw new StorytellerError(`The storyteller hit a snag reading that (${err.status}). Please try again.`);
    throw err;
  }
  if (message.stop_reason === "refusal") throw new StorytellerError("The storyteller couldn't read that picture. Try typing or pasting the words instead.");
  if (message.stop_reason !== "end_turn") throw new StorytellerError("That was too much to read in one go. Try fewer pictures at a time.");
  const out = message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    const { title, text } = JSON.parse(out) as { title: string; text: string };
    return { title: title.trim() || null, text: text.trim() };
  } catch {
    throw new StorytellerError("The words came back jumbled. Please try again.");
  }
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type { RawScript };
