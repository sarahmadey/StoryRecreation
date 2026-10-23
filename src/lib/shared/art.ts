import type { ArtStyle, SceneEffect, StoryArt } from "./types";

// Picture books: the styles the illustrator can paint in, the little moving
// touches of "living pictures", and how money is shown to the grown-ups.

export const ART_STYLES: Record<ArtStyle, { label: string; emoji: string; blurb: string; prompt: string }> = {
  watercolor: {
    label: "Watercolor",
    emoji: "🎨",
    blurb: "Soft washes and ink, like a classic bedtime book",
    prompt:
      "soft watercolor and ink illustration: gentle washes of color, delicate ink linework, warm cozy palette, the look of a classic bedtime picture book",
  },
  gouache: {
    label: "Painted",
    emoji: "🖌️",
    blurb: "Rich, bright gouache",
    prompt: "rich gouache painting: bold cheerful colors, soft textured brushwork, a modern picture book",
  },
  pencil: {
    label: "Colored pencil",
    emoji: "✏️",
    blurb: "Hand-drawn and cozy",
    prompt: "colored pencil and crayon illustration on textured paper: hand-drawn, warm and cozy, visible pencil strokes",
  },
  papercut: {
    label: "Cut paper",
    emoji: "✂️",
    blurb: "Layered paper collage",
    prompt: "layered cut-paper collage illustration: textured papers, crisp shapes, soft shadows between the layers",
  },
  shadow: {
    label: "Shadow puppets",
    emoji: "🌙",
    blurb: "Silhouettes on glowing light",
    prompt:
      "shadow-puppet silhouette illustration: black cut-out shapes with fine details against a glowing warm gradient sky, like a shadow theater",
  },
};

export const DEFAULT_ART_STYLE: ArtStyle = "watercolor";

export const SCENE_EFFECTS: Record<SceneEffect, string> = {
  none: "",
  sparkles: "Fairy dust",
  snow: "Falling snow",
  rain: "Gentle rain",
  fireflies: "Fireflies",
  leaves: "Drifting leaves",
  stars: "Twinkling stars",
  bubbles: "Bubbles",
  petals: "Petals on the breeze",
};

export const sceneEffect = (value: unknown): SceneEffect =>
  typeof value === "string" && value in SCENE_EFFECTS ? (value as SceneEffect) : "none";

/** How many pictures a book of pages takes: a cover, then one a page. */
export const bookPictures = (pages: number) => pages + 1;

/** How many sketches are made of a character at a time, to choose between (more can always be asked for). */
export const SKETCHES = 2;

/** About how long one picture takes the illustrator. */
const PICTURE_SECONDS = 25;

/** About how long the illustrator takes for some pictures, two at a time (the cover first, on its own so the pages can match it). */
export function drawingSeconds(pictures: number, coverFirst: boolean, real: boolean): number {
  if (!real) return 3;
  return (coverFirst ? PICTURE_SECONDS : 0) + Math.ceil(Math.max(0, pictures - (coverFirst ? 1 : 0)) / 2) * PICTURE_SECONDS;
}

/** About how long the storyteller takes to plan a picture book's pictures (a moment, for the demo storyteller). */
export const planningSeconds = (storyteller: boolean) => (storyteller ? 30 : 3);

/** Stand-in pictures (made while the illustrator isn't set up) are drawings the app makes itself. */
export const isStandIn = (url: string | null | undefined) => Boolean(url && /\.svg(\?|$)/.test(url));

/** The picture for a page of a picture book, if it has been drawn. */
export const artForPage = (art: StoryArt | null | undefined, page: number): string | null =>
  art && page >= 1 ? (art.pages[page - 1] ?? null) : null;

/** About what a storyteller job costs, from the tokens it reads and writes, in millionths of a dollar. */
export const storytellerCost = (rates: { input: number; output: number }, inputTokens: number, outputTokens: number) =>
  Math.round(inputTokens * rates.input + outputTokens * rates.output);

/**
 * Money for grown-ups, from millionths of a dollar: "5¢", "$1.20". Rounded up,
 * so what's shown is never less than what it can cost.
 */
export function formatMoney(micros: number, zero = "free"): string {
  if (micros <= 0) return zero;
  const cents = Math.ceil(micros / 10_000);
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}
