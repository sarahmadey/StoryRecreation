import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";
import { changeStoryArt, getBook, getStoryArt, getStoryById, updateBook, updateStory } from "./db";
import { mediaTypeFor, removeDir, removeHouseholdFile, resolveHouseholdPath, storyDir } from "./files";
import { drawPicture, IllustratorError, illustratorReady, REFERENCE_TYPES, type Picture, type PictureRequest, type Reference } from "./illustrator";
import { picturePrice } from "./prices";
import { addToPurchase, getPurchase, recordSpend } from "./spending";
import { planPictures, StorytellerError, type PicturePlan } from "./storyteller";
import { demoPicturePlan } from "./demo-storyteller";
import { ART_STYLES, DEFAULT_ART_STYLE } from "@/lib/shared/art";
import { MOODS } from "@/lib/shared/options";
import type { ArtCharacter, ArtStyle, Mood, StoryArt } from "@/lib/shared/types";

// Picture books. After a story is written, the storyteller plans its pictures
// (who's in them, what they look like, what each page shows). The family
// meets the main characters as sketches and picks the right one; then the
// cover is drawn, and each page is drawn from the chosen sketches and the
// cover, so the characters and colors stay the same all the way through.
// Drawing is bought: each job runs on a purchase a grown-up approved, and
// stops before it would spend more than that.

const globalForArt = globalThis as unknown as { __storyhollowArt?: Set<string> };
const busy = (globalForArt.__storyhollowArt ??= new Set<string>());

/** True while the illustrator is working on this story's pictures. */
export const artBusy = (storyId: string) => busy.has(storyId);

export function newArt(style: ArtStyle, pages: number): StoryArt {
  return { style, status: "idle", progress: null, error: null, characters: [], coverScene: "", scenes: [], cover: null, pages: Array(pages).fill(null) };
}

/** Run the illustrator in the background, one job per story at a time. False when it's already busy. */
function launchArt(storyId: string, status: StoryArt["status"], step: string, fn: () => Promise<void>): boolean {
  if (busy.has(storyId)) return false;
  busy.add(storyId);
  changeStoryArt(storyId, (a) => a && { ...a, status, error: null, progress: { step, done: 0, total: 1 } });
  fn()
    .catch((err) => {
      console.error(`[art] ${storyId}`, err);
      const message = err instanceof IllustratorError || err instanceof StorytellerError ? err.message : "The illustrator hit a snag. Please try again.";
      changeStoryArt(storyId, (a) => a && { ...a, error: message });
    })
    .finally(() => {
      busy.delete(storyId);
      changeStoryArt(storyId, (a) => a && { ...a, status: "idle", progress: null });
    });
  return true;
}

const progress = (storyId: string, step: string, done: number, total: number) =>
  changeStoryArt(storyId, (a) => a && { ...a, progress: { step, done, total } });

/** Run `n` tasks, `width` at a time. */
async function inTurns(n: number, width: number, task: (i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(width, n) }, async () => {
    while (next < n) await task(next++);
  }));
}

/**
 * What's left of an approved purchase. A picture's price is set aside before
 * it's drawn, and settled with what it really cost, so the pictures drawn at
 * the same time can never add up to more than was approved.
 */
class Budget {
  private held = 0;
  constructor(
    private purchaseId: string,
    private price: number,
  ) {}
  take(): boolean {
    const p = getPurchase(this.purchaseId);
    if (!p || p.spent + this.held + this.price > p.approved) return false;
    this.held += this.price;
    return true;
  }
  settle(cost: number, pictures: number) {
    this.held -= this.price;
    addToPurchase(this.purchaseId, cost, pictures);
  }
}

const pictureBudget = (purchaseId: string) => new Budget(purchaseId, illustratorReady() ? picturePrice() : 0);

/** Draw one picture on the budget (its price already taken), settling what it cost. A problem comes back as words. */
async function drawWithin(budget: Budget, req: PictureRequest): Promise<Picture | string> {
  try {
    const pic = await drawPicture(req);
    budget.settle(pic.cost, 1);
    return pic;
  } catch (err) {
    budget.settle(err instanceof IllustratorError ? err.cost : 0, 0);
    if (err instanceof IllustratorError) return err.message;
    throw err;
  }
}

const EXTENSIONS: Record<string, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg" };

/** Keep a picture with the story, returning its household-relative path. */
async function savePicture(householdId: string, storyId: string, name: string, pic: Picture): Promise<string> {
  const rel = `stories/${storyId}/art/${name}-${randomUUID().slice(0, 8)}${EXTENSIONS[pic.mime] ?? ".png"}`;
  const full = resolveHouseholdPath(householdId, rel);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, pic.bytes);
  return rel;
}

/** A kept picture, to show the illustrator; null for a stand-in (an SVG the model can't take). */
async function reference(householdId: string, rel: string | null, label: string): Promise<Reference | null> {
  if (!rel) return null;
  const mime = mediaTypeFor(rel);
  if (!REFERENCE_TYPES.has(mime)) return null;
  try {
    return { data: await fs.promises.readFile(resolveHouseholdPath(householdId, rel)), mime, label };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- prompts

const RULES =
  "It is for a children's picture book. No words, letters, numbers, signs, captions, signatures or speech bubbles anywhere in the picture. Warm, friendly and safe, never frightening.";

/** A sketch of one character, alone, to choose between (or a child's drawing of them, made into a picture-book character). */
export function characterPrompt(c: Pick<ArtCharacter, "name" | "look">, style: ArtStyle, fromDrawing: boolean): string {
  const pose = "Show the whole character in a simple standing pose, facing slightly toward us, alone on a plain soft cream background.";
  return fromDrawing
    ? `Reference picture 1 is a child's own drawing of ${c.name}. Redraw that exact character as a finished picture-book character. Keep the child's design, its colors, its shapes, how many eyes, arms and legs it has, its clothes and every funny detail, so the child knows it at once, and make it lovable.${c.look ? ` About ${c.name}: ${c.look}.` : ""} ${pose} Style: ${ART_STYLES[style].prompt}. ${RULES}`
    : `A character design for a children's picture book: ${c.name}${c.look ? `, ${c.look}` : ""}. ${pose} Style: ${ART_STYLES[style].prompt}. ${RULES}`;
}

/** The cover (page 0) or a page: its scene, with each character shown from their chosen sketch, and the cover for style. */
export function sceneRequest(o: {
  title: string;
  page: number;
  scene: string;
  characters: ArtCharacter[];
  sketches: Map<string, Reference>;
  cover: Reference | null;
  style: ArtStyle;
  mood: Mood;
  note?: string;
  seed: string;
}): PictureRequest {
  const references: Reference[] = [];
  const who = o.characters.slice(0, 6).map((c) => {
    const sketch = references.length < 4 ? o.sketches.get(c.id) : undefined;
    if (sketch) {
      references.push(sketch);
      return `${c.name} looks exactly like reference picture ${references.length}${c.look ? ` (${c.look})` : ""}`;
    }
    return `${c.name}: ${c.look || "as the story describes"}`;
  });
  if (o.cover && o.page > 0) references.push(o.cover);
  const prompt = [
    o.page === 0
      ? `The front cover picture for the picture book "${o.title}". The title is added separately, so leave calm space near the top.`
      : `The picture for page ${o.page} of the picture book "${o.title}".`,
    `Scene: ${o.scene}`,
    who.length ? `Characters: ${who.join("; ")}.` : "",
    who.length && references.length ? "Keep every character's design, colors, proportions and clothes exactly as in their reference picture." : "",
    o.cover && o.page > 0 ? `Match the style, palette and lighting of the cover (reference picture ${references.length}).` : "",
    `Mood: ${MOODS[o.mood].label.toLowerCase()}. Style: ${ART_STYLES[o.style].prompt}.`,
    o.note ? `The family asked for this change: ${o.note}` : "",
    RULES,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    prompt,
    references,
    aspect: "4:3",
    standIn: { heading: o.page === 0 ? o.title : `Page ${o.page}`, caption: o.scene, style: o.style, seed: o.seed },
  };
}

// ----------------------------------------------------------------- planning

/** Turn a story into a picture book (or start its pictures over): the storyteller plans the pictures. */
export function startPictureBook(storyId: string, style: ArtStyle): boolean {
  const story = getStoryById(storyId);
  if (!story?.script || busy.has(storyId)) return false;
  const had = getStoryArt(storyId);
  changeStoryArt(storyId, () => newArt(style, story.script!.pages.length));
  if (had) void removeDir(path.join(storyDir(story.householdId, storyId), "art"));
  if (!story.settings.pictures || story.settings.artStyle !== style) updateStory(storyId, { settings: { ...story.settings, pictures: true, artStyle: style } });
  return launchArt(storyId, "planning", "Reading the story", () => plan(storyId));
}

/** A new story that's to be a picture book has just been written. */
export function planPicturesAfterWriting(storyId: string) {
  startPictureBook(storyId, getStoryById(storyId)?.settings.artStyle ?? DEFAULT_ART_STYLE);
}

async function plan(storyId: string) {
  const story = getStoryById(storyId);
  if (!story?.script) return;
  const s = story.settings;
  let result: { plan: PicturePlan; cost: number };
  if (config.anthropicKey || !config.demoMode) {
    result = await planPictures(story.script, { description: s.description, heroes: s.heroes, mood: MOODS[s.mood].label });
  } else {
    result = { plan: demoPicturePlan(story.script), cost: 0 };
  }
  if (result.cost > 0) {
    recordSpend(story.householdId, { storyId, service: "storyteller", kind: "plan", what: `Planned the pictures for “${story.script.title}”`, spent: result.cost });
  }
  changeStoryArt(
    storyId,
    (a) =>
      a && {
        ...a,
        characters: result.plan.characters.map((c) => ({ ...c, drawing: null, sketches: [], chosen: null })),
        coverScene: result.plan.cover,
        scenes: result.plan.pages,
        pages: story.script!.pages.map(() => null),
      },
  );
}

// ---------------------------------------------------------------- sketching

/** Sketch a character a few times, to choose between, on an approved purchase. */
export function startSketches(storyId: string, characterId: string, purchaseId: string, count: number): boolean {
  return launchArt(storyId, "sketching", "Sketching", () => sketch(storyId, characterId, purchaseId, count));
}

async function sketch(storyId: string, characterId: string, purchaseId: string, count: number) {
  const story = getStoryById(storyId);
  const art = getStoryArt(storyId);
  const c = art?.characters.find((x) => x.id === characterId);
  if (!story || !art || !c) return;
  const budget = pictureBudget(purchaseId);
  const drawing = await reference(story.householdId, c.drawing, `a child's drawing of ${c.name}`);
  const failures: string[] = [];
  let done = 0;
  progress(storyId, `Sketching ${c.name}`, 0, count);
  await inTurns(count, 2, async (i) => {
    const pic = budget.take()
      ? await drawWithin(budget, {
          prompt: characterPrompt(c, art.style, Boolean(drawing)),
          references: drawing ? [drawing] : [],
          aspect: "1:1",
          standIn: { heading: c.name, caption: c.look || `What ${c.name} looks like`, style: art.style, seed: `${storyId}-${c.id}-${Date.now()}-${i}` },
        })
      : "That's all the approved purchase covers.";
    if (typeof pic === "string") failures.push(pic);
    else {
      const rel = await savePicture(story.householdId, storyId, `sketch-${c.id}`, pic);
      changeStoryArt(storyId, (a) => a && { ...a, characters: a.characters.map((x) => (x.id === characterId ? { ...x, sketches: [...x.sketches, rel] } : x)) });
    }
    progress(storyId, `Sketching ${c.name}`, ++done, count);
  });
  if (failures.length) {
    throw new IllustratorError(failures.length === count ? failures[0] : `${count - failures.length} of ${count} sketches were made. ${failures[0]}`);
  }
}

// ------------------------------------------------------------------ drawing

/** Draw the cover (0) and the given pages, on an approved purchase. */
export function startDrawing(storyId: string, targets: number[], purchaseId: string, note?: string): boolean {
  const step = targets.length === 1 ? (targets[0] === 0 ? "Drawing the cover" : `Drawing page ${targets[0]}`) : "Drawing the book";
  return launchArt(storyId, "drawing", step, () => draw(storyId, targets, purchaseId, note));
}

/** What still needs drawing: the cover (0) and any page without a picture. */
export function undrawn(art: StoryArt): number[] {
  return [...(art.cover ? [] : [0]), ...art.pages.flatMap((p, i) => (p ? [] : [i + 1]))];
}

async function draw(storyId: string, targets: number[], purchaseId: string, note?: string) {
  const story = getStoryById(storyId);
  const art = getStoryArt(storyId);
  if (!story?.script || !art) return;
  const householdId = story.householdId;
  const budget = pictureBudget(purchaseId);

  // Each main character is drawn from their chosen sketch.
  const sketches = new Map<string, Reference>();
  for (const c of art.characters) {
    const chosen = c.chosen !== null ? c.sketches[c.chosen] : null;
    const ref = c.main && chosen ? await reference(householdId, chosen, `${c.name}${c.look ? `, ${c.look}` : ""}`) : null;
    if (ref) sketches.set(c.id, ref);
  }
  let cover = await reference(householdId, art.cover, "the book's cover");

  const failed: number[] = [];
  let firstProblem = "";
  let done = 0;
  const total = targets.length;
  const drawOne = async (target: number) => {
    const label = target === 0 ? "the cover" : `page ${target}`;
    progress(storyId, `Drawing ${label}`, done, total);
    const scene = target === 0 ? art.coverScene : (art.scenes.find((s) => s.page === target)?.scene ?? "");
    const ids = target === 0 ? art.characters.filter((c) => c.main).map((c) => c.id) : (art.scenes.find((s) => s.page === target)?.characters ?? []);
    const pic = budget.take()
      ? await drawWithin(
          budget,
          sceneRequest({
            title: story.script!.title,
            page: target,
            scene,
            characters: ids.map((id) => art.characters.find((c) => c.id === id)).filter((c): c is ArtCharacter => Boolean(c)),
            sketches,
            cover,
            style: art.style,
            mood: story.settings.mood,
            note,
            seed: `${storyId}-${target}-${Date.now()}`,
          }),
        )
      : "That's all the approved purchase covers.";
    if (typeof pic === "string") {
      failed.push(target);
      firstProblem ||= pic;
    } else {
      const rel = await savePicture(householdId, storyId, target === 0 ? "cover" : `page-${String(target).padStart(2, "0")}`, pic);
      let replaced: string | null = null;
      changeStoryArt(storyId, (a) => {
        if (!a) return a;
        replaced = target === 0 ? a.cover : (a.pages[target - 1] ?? null);
        if (target === 0) return { ...a, cover: rel };
        const pages = [...a.pages];
        pages[target - 1] = rel;
        return { ...a, pages };
      });
      // A redrawn picture replaces the old one.
      if (replaced) await removeHouseholdFile(householdId, replaced).catch(() => undefined);
      if (target === 0) {
        cover = REFERENCE_TYPES.has(pic.mime) ? { data: pic.bytes, mime: pic.mime, label: "the book's cover" } : null;
        if (!pic.standIn) await coverTheBook(householdId, story.bookId, pic);
      }
    }
    progress(storyId, `Drawing ${label}`, ++done, total);
  };

  // The cover first, so every page can match its colors and style; then the pages, two at a time.
  const pages = targets.filter((t) => t !== 0);
  if (targets.includes(0)) await drawOne(0);
  await inTurns(pages.length, 2, (i) => drawOne(pages[i]));

  if (failed.length) {
    const which = failed.sort((a, b) => a - b).map((t) => (t === 0 ? "the cover" : `page ${t}`));
    const list = which.length > 1 ? `${which.slice(0, -1).join(", ")} and ${which.at(-1)}` : which[0];
    throw new IllustratorError(`${list.charAt(0).toUpperCase()}${list.slice(1)} couldn't be drawn. ${firstProblem} You can try again below.`);
  }
}

/** A book dreamed up from an idea has no cover of its own: its first picture book's cover becomes it. */
async function coverTheBook(householdId: string, bookId: string, pic: Picture) {
  const book = getBook(householdId, bookId);
  if (!book || book.coverUrl || book.kind !== "idea") return;
  const rel = `books/${bookId}/cover-${randomUUID().slice(0, 8)}${EXTENSIONS[pic.mime] ?? ".png"}`;
  const full = resolveHouseholdPath(householdId, rel);
  await fs.promises.mkdir(path.dirname(full), { recursive: true });
  await fs.promises.writeFile(full, pic.bytes);
  updateBook(householdId, bookId, { coverPath: rel });
}

/** A restart stops the illustrator mid-job: whatever it finished is kept, and the family can carry on. */
export function settleLostArt(storyId: string) {
  const art = getStoryArt(storyId);
  if (!art || art.status === "idle" || busy.has(storyId)) return;
  changeStoryArt(
    storyId,
    (a) => a && { ...a, status: "idle", progress: null, error: "The illustrator was interrupted. Anything finished is kept: carry on when you're ready." },
  );
}
