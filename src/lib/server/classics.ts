import { config } from "./config";
import { cacheCatalogue, cacheClassic, getCachedCatalogue, getCachedClassic } from "./db";
import { chapterize, cleanGutenberg, type Chapter } from "./text";

// The Classic Treasury: public-domain children's books from Project
// Gutenberg. The curated books are fetched straight from Gutenberg by number;
// the Gutendex catalogue (free, but often slow) is only used for searching.
// Modern picture books are still under copyright and aren't in any open
// database, so for those the family photographs their own copy instead.

export interface Classic {
  slug: string;
  /** The book's Project Gutenberg number. */
  gutenbergId: number;
  title: string;
  author: string;
  emoji: string;
  ages: string;
  blurb: string;
  color: string;
  /** The kinds of story it is, beyond "most loved" (which every treasury book is). */
  kinds: TopicId[];
}

export const CLASSICS: Classic[] = [
  { slug: "peter-rabbit", gutenbergId: 14838, title: "The Tale of Peter Rabbit", author: "Beatrix Potter", emoji: "🐇", ages: "2+", blurb: "A naughty rabbit, a vegetable garden and a very close call.", color: "#4a6b3a", kinds: ["animals"] },
  { slug: "velveteen-rabbit", gutenbergId: 11757, title: "The Velveteen Rabbit", author: "Margery Williams", emoji: "🧸", ages: "4+", blurb: "How a toy becomes Real, through being loved.", color: "#7a4a5a", kinds: [] },
  { slug: "winnie-the-pooh", gutenbergId: 67098, title: "Winnie-the-Pooh", author: "A. A. Milne", emoji: "🍯", ages: "3+", blurb: "Pooh, Piglet and friends in the Hundred Acre Wood.", color: "#b07a1f", kinds: ["animals"] },
  { slug: "just-so-stories", gutenbergId: 2781, title: "Just So Stories", author: "Rudyard Kipling", emoji: "🐘", ages: "5+", blurb: "How the Elephant got his trunk, and other wonders.", color: "#8a5a2a", kinds: ["animals", "fables"] },
  { slug: "wind-in-the-willows", gutenbergId: 289, title: "The Wind in the Willows", author: "Kenneth Grahame", emoji: "🛶", ages: "6+", blurb: "Mole, Ratty, Badger and the irrepressible Mr. Toad.", color: "#2f5b4a", kinds: ["animals", "adventure"] },
  { slug: "wizard-of-oz", gutenbergId: 55, title: "The Wonderful Wizard of Oz", author: "L. Frank Baum", emoji: "🌪️", ages: "6+", blurb: "Dorothy follows the yellow brick road.", color: "#2d6b3a", kinds: ["fairy", "adventure"] },
  { slug: "alice", gutenbergId: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", emoji: "🐰", ages: "6+", blurb: "Down the rabbit hole and into Wonderland.", color: "#3a4f86", kinds: ["fairy", "adventure"] },
  { slug: "peter-pan", gutenbergId: 16, title: "Peter Pan", author: "J. M. Barrie", emoji: "🧚", ages: "6+", blurb: "Second star to the right, and straight on till morning.", color: "#2d5f6b", kinds: ["fairy", "adventure"] },
  { slug: "aesop", gutenbergId: 11339, title: "Aesop's Fables", author: "Aesop", emoji: "🦊", ages: "4+", blurb: "Tiny tales with big morals: the tortoise, the hare and more.", color: "#6b4a2a", kinds: ["fables", "animals"] },
  { slug: "grimm", gutenbergId: 2591, title: "Grimms' Fairy Tales", author: "Jacob & Wilhelm Grimm", emoji: "🏰", ages: "5+", blurb: "Rapunzel, Hansel and Gretel, the Elves and the Shoemaker.", color: "#6e3b3b", kinds: ["fairy"] },
  { slug: "andersen", gutenbergId: 1597, title: "Andersen's Fairy Tales", author: "Hans Christian Andersen", emoji: "🦢", ages: "5+", blurb: "The Ugly Duckling, Thumbelina and the Snow Queen.", color: "#3f5f86", kinds: ["fairy"] },
  { slug: "english-fairy-tales", gutenbergId: 7439, title: "English Fairy Tales", author: "Joseph Jacobs", emoji: "🐷", ages: "3+", blurb: "Goldilocks, the Three Little Pigs and Jack and the Beanstalk.", color: "#7a5a2a", kinds: ["fairy"] },
  { slug: "happy-prince", gutenbergId: 902, title: "The Happy Prince and Other Tales", author: "Oscar Wilde", emoji: "👑", ages: "6+", blurb: "A golden statue and a little swallow who stays.", color: "#8a6a1f", kinds: ["fairy"] },
  { slug: "pinocchio", gutenbergId: 500, title: "The Adventures of Pinocchio", author: "Carlo Collodi", emoji: "🪵", ages: "6+", blurb: "A wooden puppet who longs to be a real boy.", color: "#7a3f2a", kinds: ["fairy", "adventure"] },
  { slug: "jungle-book", gutenbergId: 236, title: "The Jungle Book", author: "Rudyard Kipling", emoji: "🐯", ages: "7+", blurb: "Mowgli, Baloo, Bagheera and Shere Khan.", color: "#3a5a2a", kinds: ["animals", "adventure"] },
  { slug: "secret-garden", gutenbergId: 113, title: "The Secret Garden", author: "Frances Hodgson Burnett", emoji: "🗝️", ages: "8+", blurb: "A locked garden, a robin and a little magic.", color: "#4a6b4a", kinds: [] },
];

/** Ways to browse the whole library, as Gutendex topics (matched against Gutenberg's subjects and shelves). */
export const TOPICS = [
  { id: "loved", label: "Most loved", emoji: "⭐", topic: "children" },
  { id: "animals", label: "Animal stories", emoji: "🐻", topic: "animals -- juvenile" },
  { id: "fairy", label: "Fairy tales", emoji: "🧚", topic: "fairy tales" },
  { id: "picture", label: "Picture books", emoji: "🎨", topic: "picture books" },
  { id: "poems", label: "Poems & rhymes", emoji: "🌙", topic: "children's poetry" },
  { id: "fables", label: "Fables & myths", emoji: "🦊", topic: "fables" },
  { id: "adventure", label: "Adventure", emoji: "🏝️", topic: "adventure and adventurers -- juvenile" },
  { id: "christmas", label: "Christmas", emoji: "🎄", topic: "christmas -- juvenile" },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
  languages: string[];
  download_count: number;
}

const GUTENBERG_TEXT = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;

export class ClassicsError extends Error {}

/** Fetch with a time limit, so a slow library never leaves a family waiting forever. */
async function get(url: string, seconds: number): Promise<Response> {
  try {
    return await fetch(url, { headers: { "User-Agent": "Storyhollow/1.0 (family audio stories)" }, signal: AbortSignal.timeout(seconds * 1000) });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new ClassicsError("The Gutenberg library is taking too long to answer. Please try again in a minute.");
    }
    throw new ClassicsError("The Gutenberg library couldn't be reached.");
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await get(url, 20);
  if (!res.ok) throw new ClassicsError(`The Gutenberg catalogue answered ${res.status}.`);
  return (await res.json()) as T;
}

/** "Title:" and "Author:" from the header Gutenberg puts at the top of every text. */
export function gutenbergHeader(raw: string): { title: string | null; author: string | null } {
  const head = raw.slice(0, 6000);
  const field = (name: string) => head.match(new RegExp(`^${name}:[ \\t]*(.+)$`, "m"))?.[1].trim() || null;
  return { title: field("Title"), author: field("Author") };
}

function textUrl(b: GutendexBook): string | null {
  const key = Object.keys(b.formats).find((k) => k.startsWith("text/plain") && !b.formats[k].endsWith(".zip"));
  return key ? b.formats[key] : null;
}

export interface CatalogueHit {
  gutenbergId: number;
  title: string;
  author: string | null;
  cover: string | null;
}

export interface CataloguePage {
  results: CatalogueHit[];
  more: boolean;
}

/** "Peter Pan; or, The Boy Who Wouldn't Grow Up" reads better on a little cover as "Peter Pan". */
export function shortTitle(title: string): string {
  const main = title.split(/;|:|\r?\n| — /)[0].trim();
  return main.length >= 3 ? main : title.trim();
}

/** Gutenberg lists authors as "Carroll, Lewis (Charles Lutwidge Dodgson)": a child would say "Lewis Carroll". */
export function authorName(name: string | undefined): string | null {
  if (!name) return null;
  const plain = name.replace(/\s*\([^)]*\)/g, "").trim();
  const [last, first] = plain.split(/,\s*/);
  return first ? `${first} ${last}` : plain;
}

const CATALOGUE_FRESH = 7 * 24 * 3600 * 1000;

/**
 * One page of the library: books matching a search (title or author), or a
 * topic, most-downloaded first. Answers are kept for a week, because the
 * free catalogue can be slow.
 */
export async function browseCatalogue({ q, topic, page = 1 }: { q?: string; topic?: TopicId; page?: number }): Promise<CataloguePage> {
  const params = new URLSearchParams({ languages: "en", mime_type: "text/plain", page: String(Math.max(1, Math.floor(page))) });
  if (q) params.set("search", q.slice(0, 100));
  const t = TOPICS.find((x) => x.id === topic);
  if (t && !q) params.set("topic", t.topic);
  const url = `${config.gutendexUrl}?${params}`;
  const cached = getCachedCatalogue<CataloguePage>(url, CATALOGUE_FRESH);
  if (cached) return cached;
  const data = await fetchJson<{ results: GutendexBook[]; next: string | null }>(url);
  const result: CataloguePage = {
    results: data.results
      .filter((b) => textUrl(b))
      .map((b) => ({ gutenbergId: b.id, title: shortTitle(b.title), author: authorName(b.authors[0]?.name), cover: b.formats["image/jpeg"] ?? null })),
    more: Boolean(data.next),
  };
  cacheCatalogue(url, result);
  return result;
}

let warming: Promise<void> | null = null;

/** Fetch each topic's first page in the background, so browsing is quick when a family gets there. */
export function warmCatalogue(): void {
  warming ??= (async () => {
    for (const t of TOPICS) await browseCatalogue({ topic: t.id }).catch(() => undefined);
  })().finally(() => {
    warming = null;
  });
}

export interface LoadedClassic {
  gutenbergId: number;
  title: string;
  author: string | null;
  chapters: Chapter[];
}

export async function loadClassic(gutenbergId: number): Promise<LoadedClassic> {
  let cached = getCachedClassic(gutenbergId);
  if (!cached) {
    // Straight from Gutenberg by number; the catalogue is only asked if that fails.
    let raw: string | null = null;
    const direct = await get(GUTENBERG_TEXT(gutenbergId), 30).catch(() => null);
    if (direct?.ok) raw = await direct.text();
    else {
      const book = await fetchJson<GutendexBook>(`${config.gutendexUrl}/${gutenbergId}`);
      const url = textUrl(book);
      if (!url) throw new ClassicsError("That book has no plain-text edition.");
      const res = await get(url, 30);
      if (!res.ok) throw new ClassicsError(`Project Gutenberg answered ${res.status}.`);
      raw = await res.text();
    }
    const curated = CLASSICS.find((c) => c.gutenbergId === gutenbergId);
    const header = gutenbergHeader(raw);
    cached = {
      title: curated?.title ?? header.title ?? "A classic",
      author: curated?.author ?? header.author,
      text: cleanGutenberg(raw),
    };
    cacheClassic(gutenbergId, cached.title, cached.author, cached.text);
  }
  return { gutenbergId, title: cached.title, author: cached.author, chapters: chapterize(cached.text) };
}
