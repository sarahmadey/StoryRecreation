import { cacheClassic, getCachedClassic } from "./db";
import { chapterize, cleanGutenberg, type Chapter } from "./text";

// The Classic Treasury: public-domain children's books from Project
// Gutenberg (via the Gutendex catalogue). Modern picture books are still
// under copyright and aren't in any open database, so for those the family
// photographs their own copy instead.

export interface Classic {
  slug: string;
  title: string;
  author: string;
  emoji: string;
  ages: string;
  blurb: string;
  /** Used to find the book in the Gutendex catalogue. */
  search: string;
  color: string;
}

export const CLASSICS: Classic[] = [
  { slug: "peter-rabbit", title: "The Tale of Peter Rabbit", author: "Beatrix Potter", emoji: "🐇", ages: "2+", blurb: "A naughty rabbit, a vegetable garden and a very close call.", search: "tale of peter rabbit potter", color: "#4a6b3a" },
  { slug: "velveteen-rabbit", title: "The Velveteen Rabbit", author: "Margery Williams", emoji: "🧸", ages: "4+", blurb: "How a toy becomes Real, through being loved.", search: "velveteen rabbit williams", color: "#7a4a5a" },
  { slug: "winnie-the-pooh", title: "Winnie-the-Pooh", author: "A. A. Milne", emoji: "🍯", ages: "3+", blurb: "Pooh, Piglet and friends in the Hundred Acre Wood.", search: "winnie-the-pooh milne", color: "#b07a1f" },
  { slug: "just-so-stories", title: "Just So Stories", author: "Rudyard Kipling", emoji: "🐘", ages: "5+", blurb: "How the Elephant got his trunk, and other wonders.", search: "just so stories kipling", color: "#8a5a2a" },
  { slug: "wind-in-the-willows", title: "The Wind in the Willows", author: "Kenneth Grahame", emoji: "🛶", ages: "6+", blurb: "Mole, Ratty, Badger and the irrepressible Mr. Toad.", search: "wind in the willows grahame", color: "#2f5b4a" },
  { slug: "wizard-of-oz", title: "The Wonderful Wizard of Oz", author: "L. Frank Baum", emoji: "🌪️", ages: "6+", blurb: "Dorothy follows the yellow brick road.", search: "wonderful wizard of oz baum", color: "#2d6b3a" },
  { slug: "alice", title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", emoji: "🐰", ages: "6+", blurb: "Down the rabbit hole and into Wonderland.", search: "alice's adventures in wonderland carroll", color: "#3a4f86" },
  { slug: "peter-pan", title: "Peter Pan", author: "J. M. Barrie", emoji: "🧚", ages: "6+", blurb: "Second star to the right, and straight on till morning.", search: "peter pan barrie", color: "#2d5f6b" },
  { slug: "aesop", title: "Aesop's Fables", author: "Aesop", emoji: "🦊", ages: "4+", blurb: "Tiny tales with big morals: the tortoise, the hare and more.", search: "aesop's fables", color: "#6b4a2a" },
  { slug: "grimm", title: "Grimms' Fairy Tales", author: "Jacob & Wilhelm Grimm", emoji: "🏰", ages: "5+", blurb: "Rapunzel, Hansel and Gretel, the Elves and the Shoemaker.", search: "grimms' fairy tales", color: "#6e3b3b" },
  { slug: "andersen", title: "Andersen's Fairy Tales", author: "Hans Christian Andersen", emoji: "🦢", ages: "5+", blurb: "The Ugly Duckling, Thumbelina and the Snow Queen.", search: "andersen's fairy tales", color: "#3f5f86" },
  { slug: "english-fairy-tales", title: "English Fairy Tales", author: "Joseph Jacobs", emoji: "🐷", ages: "3+", blurb: "Goldilocks, the Three Little Pigs and Jack and the Beanstalk.", search: "english fairy tales jacobs", color: "#7a5a2a" },
  { slug: "happy-prince", title: "The Happy Prince and Other Tales", author: "Oscar Wilde", emoji: "👑", ages: "6+", blurb: "A golden statue and a little swallow who stays.", search: "happy prince wilde", color: "#8a6a1f" },
  { slug: "pinocchio", title: "The Adventures of Pinocchio", author: "Carlo Collodi", emoji: "🪵", ages: "6+", blurb: "A wooden puppet who longs to be a real boy.", search: "adventures of pinocchio collodi", color: "#7a3f2a" },
  { slug: "jungle-book", title: "The Jungle Book", author: "Rudyard Kipling", emoji: "🐯", ages: "7+", blurb: "Mowgli, Baloo, Bagheera and Shere Khan.", search: "jungle book kipling", color: "#3a5a2a" },
  { slug: "secret-garden", title: "The Secret Garden", author: "Frances Hodgson Burnett", emoji: "🗝️", ages: "8+", blurb: "A locked garden, a robin and a little magic.", search: "secret garden burnett", color: "#4a6b4a" },
];

interface GutendexBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: Record<string, string>;
  languages: string[];
  download_count: number;
}

const GUTENDEX = "https://gutendex.com/books";

export class ClassicsError extends Error {}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": "Storyhollow/1.0 (family audio stories)" } });
  if (!res.ok) throw new ClassicsError(`The Gutenberg catalogue answered ${res.status}.`);
  return (await res.json()) as T;
}

function textUrl(b: GutendexBook): string | null {
  const key = Object.keys(b.formats).find((k) => k.startsWith("text/plain") && !b.formats[k].endsWith(".zip"));
  return key ? b.formats[key] : null;
}

export interface CatalogueHit {
  gutenbergId: number;
  title: string;
  author: string | null;
}

export async function searchGutenberg(query: string): Promise<CatalogueHit[]> {
  const url = `${GUTENDEX}?languages=en&search=${encodeURIComponent(query)}`;
  const data = await fetchJson<{ results: GutendexBook[] }>(url);
  return data.results
    .filter((b) => textUrl(b))
    .slice(0, 12)
    .map((b) => ({ gutenbergId: b.id, title: b.title, author: b.authors[0]?.name ?? null }));
}

/** Find a curated classic's Gutenberg id (most-downloaded match). */
export async function resolveClassic(c: Classic): Promise<number> {
  const data = await fetchJson<{ results: GutendexBook[] }>(`${GUTENDEX}?languages=en&search=${encodeURIComponent(c.search)}`);
  const want = c.title.toLowerCase().replace(/[^a-z]/g, "");
  const candidates = data.results.filter((b) => textUrl(b));
  const best =
    candidates.find((b) => b.title.toLowerCase().replace(/[^a-z]/g, "").startsWith(want)) ??
    candidates.sort((a, b) => b.download_count - a.download_count)[0];
  if (!best) throw new ClassicsError(`Couldn't find "${c.title}" in the Gutenberg catalogue.`);
  return best.id;
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
    const book = await fetchJson<GutendexBook>(`${GUTENDEX}/${gutenbergId}`);
    const url = textUrl(book);
    if (!url) throw new ClassicsError("That book has no plain-text edition.");
    const res = await fetch(url, { headers: { "User-Agent": "Storyhollow/1.0 (family audio stories)" } });
    if (!res.ok) throw new ClassicsError(`Project Gutenberg answered ${res.status}.`);
    const text = cleanGutenberg(await res.text());
    cached = { title: book.title, author: book.authors[0]?.name ?? null, text };
    cacheClassic(gutenbergId, cached.title, cached.author, text);
  }
  return { gutenbergId, title: cached.title, author: cached.author, chapters: chapterize(cached.text) };
}
