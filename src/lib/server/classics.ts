import { gunzipSync } from "node:zlib";
import { config } from "./config";
import { cacheClassic, catalogueBook, catalogueLoadedAt, catalogueTopicsOf, getCachedClassic, queryCatalogue, replaceCatalogue, type CatalogueRow } from "./db";
import { chapterize, cleanGutenberg, type Chapter } from "./text";
import { gutenbergCover } from "@/lib/shared/gutenberg";

// The Classic Treasury: public-domain children's books from Project
// Gutenberg. The curated books are fetched straight from Gutenberg by number,
// and the whole library is browsed from Storyhollow's own copy of Gutenberg's
// catalogue. Modern picture books are still under copyright and aren't in any
// open database, so for those the family photographs their own copy instead.

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

/**
 * Ways to browse the whole library. Each matches phrases in Gutenberg's own
 * subjects and bookshelves ("Animals -- Juvenile fiction").
 */
export const TOPICS = [
  {
    id: "loved",
    label: "Children's classics",
    emoji: "📚",
    match: ["juvenile fiction", "juvenile literature", "children's literature", "children's stories", "children & young adult"],
  },
  {
    id: "animals",
    label: "Animal stories",
    emoji: "🐻",
    match: ["animals -- juvenile", "pets -- juvenile", "dogs -- juvenile", "cats -- juvenile", "horses -- juvenile", "rabbits -- juvenile", "bears -- juvenile"],
  },
  { id: "fairy", label: "Fairy tales", emoji: "🧚", match: ["fairy tales", "folklore -- juvenile"] },
  { id: "picture", label: "Picture books", emoji: "🎨", match: ["picture books", "stories in rhyme", "toy and movable books"] },
  { id: "poems", label: "Poems & rhymes", emoji: "🌙", match: ["children's poetry", "nursery rhymes", "juvenile poetry"] },
  { id: "fables", label: "Fables & myths", emoji: "🦊", match: ["fables", "mythology -- juvenile"] },
  {
    id: "adventure",
    label: "Adventure",
    emoji: "🏝️",
    match: ["adventure and adventurers -- juvenile", "voyages and travels -- juvenile", "pirates -- juvenile", "islands -- juvenile"],
  },
  { id: "christmas", label: "Christmas", emoji: "🎄", match: ["christmas -- juvenile", "christmas stories", "santa claus"] },
] as const;
export type TopicId = (typeof TOPICS)[number]["id"];

const GUTENBERG_TEXT = (id: number) => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
const GUTENBERG_TEXT_ALT = (id: number) => `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;

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

/** "Title:" and "Author:" from the header Gutenberg puts at the top of every text. */
export function gutenbergHeader(raw: string): { title: string | null; author: string | null } {
  const head = raw.slice(0, 6000);
  const field = (name: string) => head.match(new RegExp(`^${name}:[ \\t]*(.+)$`, "m"))?.[1].trim() || null;
  return { title: field("Title"), author: field("Author") };
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
  /** How many books match in all. */
  total: number;
  /** Ways to narrow these books down ("Dogs · 84"), on the first page of a kind or a search. */
  refinements?: Refinement[];
}

/** One subject many of the books share, to narrow a long list down by. */
export interface Refinement {
  id: string;
  label: string;
  count: number;
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

/** The first author in the catalogue's list, without dates or roles: "Carroll, Lewis, 1832-1898; Tenniel, John [Illustrator]". */
export function firstAuthor(authors: string): string | undefined {
  const first = authors.split(";")[0]?.replace(/\[[^\]]*\]/g, "").trim();
  return first ? first.replace(/,\s*[^,]*\d[^,]*$/, "").trim() || undefined : undefined;
}

/** Rows of a CSV file, whose quoted fields may hold commas, doubled quotes and line breaks. */
export function* parseCsv(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      yield row;
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

// ---------------------------------------------------------- the whole library
//
// Project Gutenberg publishes its catalogue as one file. Storyhollow keeps its
// own copy, refreshed weekly, so browsing and searching are quick and never
// wait on anyone else's server.

const CATALOGUE_FRESH = 7 * 24 * 3600 * 1000;
const PAGE_SIZE = 24;

/** Words a family might search for, and the phrases Gutenberg's subjects use for them. */
const SEARCH_ALSO: Record<string, string[]> = {
  romance: ["love stories"],
  romantic: ["love stories"],
  love: ["love stories"],
  scary: ["ghost stories", "horror"],
  spooky: ["ghost stories", "witches", "halloween"],
  funny: ["humorous stories", "humor"],
  silly: ["humorous stories", "nonsense"],
  mystery: ["detective and mystery stories"],
  detective: ["detective and mystery stories"],
  bedtime: ["lullabies"],
  princess: ["princesses"],
  magic: ["magic", "wizards", "witches"],
  space: ["outer space", "science fiction"],
};

/**
 * What a family typed, as groups of words to look for: each word, its
 * singular ("dragons" finds "Dragon"), and the subject phrases it means.
 */
export function searchGroups(q: string): { groups: string[][]; phrase: string } {
  const phrase = q.trim().replace(/\s+/g, " ").slice(0, 100);
  const words = phrase.toLowerCase().split(" ").filter((w) => w.length > 1).slice(0, 6);
  const groups = (words.length ? words : [phrase.toLowerCase()]).map((w) => {
    const forms = new Set([w, ...(SEARCH_ALSO[w] ?? [])]);
    if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) forms.add(w.slice(0, -1));
    return [...forms];
  });
  return { groups, phrase };
}

/** Download Gutenberg's catalogue and keep its English books. Returns how many there are. */
export async function refreshCatalogue(): Promise<number> {
  const res = await get(config.gutenbergCatalogUrl, 120);
  if (!res.ok) throw new ClassicsError(`Project Gutenberg answered ${res.status}.`);
  const body = Buffer.from(await res.arrayBuffer());
  const text = (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString("utf8");
  const rows: CatalogueRow[] = [];
  let col: Record<string, number> | null = null;
  for (const cells of parseCsv(text)) {
    if (!col) {
      col = Object.fromEntries(cells.map((name, i) => [name.trim(), i]));
      continue;
    }
    const at = (name: string) => cells[col![name]] ?? "";
    const id = Number(at("Text#"));
    if (!Number.isInteger(id) || id <= 0 || at("Type") !== "Text" || !at("Language").split(/;\s*/).includes("en")) continue;
    rows.push({
      id,
      title: shortTitle(at("Title")),
      author: authorName(firstAuthor(at("Authors"))),
      topics: `${at("Subjects")}; ${at("Bookshelves")}`.toLowerCase(),
    });
  }
  if (!rows.length) throw new ClassicsError("Project Gutenberg's catalogue came back empty.");
  replaceCatalogue(rows);
  return rows.length;
}

let refreshing: Promise<number> | null = null;
const refreshOnce = () => {
  refreshing ??= refreshCatalogue().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

/** Fetch the catalogue the first time; after that, refresh it in the background once it's a week old. */
async function ensureCatalogue(): Promise<void> {
  const loadedAt = catalogueLoadedAt();
  if (!loadedAt) await refreshOnce();
  else if (Date.now() - loadedAt > CATALOGUE_FRESH) void refreshOnce().catch((err) => console.warn("Catalogue refresh failed:", err));
}

/** One page of the library: books matching a search (title, author or subject), or a kind of story, optionally narrowed by one subject. */
export async function browseCatalogue({
  q,
  topic,
  refine,
  page = 1,
}: {
  q?: string;
  topic?: TopicId;
  refine?: string;
  page?: number;
}): Promise<CataloguePage> {
  await ensureCatalogue();
  const offset = (Math.max(1, Math.floor(page)) - 1) * PAGE_SIZE;
  const search = q?.trim() ? searchGroups(q) : undefined;
  const match = search ? undefined : (TOPICS.find((t) => t.id === topic) ?? TOPICS[0]).match;
  const { rows, total } = queryCatalogue({ search, match, refine: refine?.trim() || undefined, limit: PAGE_SIZE, offset });
  return {
    results: rows.map((r) => ({ gutenbergId: r.id, title: r.title, author: r.author, cover: gutenbergCover(r.id) })),
    more: offset + rows.length < total,
    total,
    ...(offset === 0 && !refine ? { refinements: refinementsFor(search ? `q:${search.phrase.toLowerCase()}` : `t:${topic}`, search, match) } : {}),
  };
}

// Subjects too general to narrow anything down in a library of children's books.
const GENERAL_SUBJECTS = /juvenile|children|young adult|^fiction$|^stories$|^short stories$|^literature$|^poetry$|^english|^american|^readers$/;
// How Library of Congress subjects read on a chip.
const SUBJECT_LABELS: Record<string, string> = {
  "adventure and adventurers": "Adventure",
  "conduct of life": "Good behaviour",
  "brothers and sisters": "Brothers & sisters",
  "voyages and travels": "Travel",
  "human-animal relationships": "People & animals",
  "humorous stories": "Funny stories",
  "mystery and detective stories": "Mysteries",
  "domestic animals": "Farm animals",
  "fantasy literature": "Fantasy",
  "fantasy fiction": "Fantasy",
  "kings, queens, rulers, etc": "Kings & queens",
  "princes": "Princes",
  "princesses": "Princesses",
  "schools": "School",
  "school stories": "School",
  "united states": "America",
  "great britain": "Britain",
  "sea stories": "The sea",
  "stories in rhyme": "Rhymes",
  "nonsense verses": "Nonsense rhymes",
  "christmas stories": "Christmas",
};
const refinementCache = new Map<string, { at: number | null; list: Refinement[] }>();

/** The subjects most shared by the books a kind or search finds, as ways to narrow them down. Cached until the library changes. */
function refinementsFor(key: string, search: ReturnType<typeof searchGroups> | undefined, match: readonly string[] | undefined): Refinement[] {
  const at = catalogueLoadedAt();
  const cached = refinementCache.get(key);
  if (cached && cached.at === at) return cached.list;
  const list = subjectRefinements(catalogueTopicsOf({ search, match }), match);
  if (refinementCache.size > 200) refinementCache.clear();
  refinementCache.set(key, { at, list });
  return list;
}

/** The ten subjects most shared by these books (each "subject; subject -- detail; …"), leaving out the kind's own and the too general. */
export function subjectRefinements(topics: string[], match?: readonly string[]): Refinement[] {
  // The kind's own subjects ("animals" for Animal stories) would narrow nothing.
  const own = new Set((match ?? []).map((m) => m.split(" -- ")[0].trim()));
  const counts = new Map<string, number>();
  for (const t of topics) {
    const heads = new Set<string>();
    for (const part of t.split(";")) {
      const head = part.split(" -- ")[0].replace(/\(.*?\)/g, "").replace(/[.,\s]+$/, "").trim();
      if (head.length < 3 || head.length > 32 || head.includes(":") || head.includes("bookshelf") || GENERAL_SUBJECTS.test(head) || own.has(head)) continue;
      heads.add(head);
    }
    for (const h of heads) counts.set(h, (counts.get(h) ?? 0) + 1);
  }
  return [...counts]
    .filter(([, n]) => n >= 4 && n < topics.length * 0.9)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([h]) => ({
      id: h,
      label: SUBJECT_LABELS[h] ?? h.charAt(0).toUpperCase() + h.slice(1),
      // counted just as narrowing finds them (the words anywhere in a book's subjects), so the number on the chip is the number shown
      count: topics.filter((t) => t.includes(h)).length,
    }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

/** Get the catalogue ready in the background, so browsing is quick when a family gets there. */
export function warmCatalogue(): void {
  void ensureCatalogue().catch((err) => console.warn("Catalogue unavailable:", err));
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
    // Straight from Gutenberg by number, from its usual place or its other one.
    let res = await get(GUTENBERG_TEXT(gutenbergId), 30).catch(() => null);
    if (!res?.ok) res = await get(GUTENBERG_TEXT_ALT(gutenbergId), 30);
    if (!res.ok) throw new ClassicsError(res.status === 404 ? "That book has no plain-text edition." : `Project Gutenberg answered ${res.status}.`);
    const raw = await res.text();
    const curated = CLASSICS.find((c) => c.gutenbergId === gutenbergId);
    const listed = catalogueBook(gutenbergId);
    const header = gutenbergHeader(raw);
    cached = {
      title: curated?.title ?? listed?.title ?? header.title ?? "A classic",
      author: curated?.author ?? listed?.author ?? header.author,
      text: cleanGutenberg(raw),
    };
    cacheClassic(gutenbergId, cached.title, cached.author, cached.text);
  }
  return { gutenbergId, title: cached.title, author: cached.author, chapters: chapterize(cached.text) };
}
