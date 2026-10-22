import { config } from "./config";
import { LENGTHS, WORDS_PER_MINUTE } from "@/lib/shared/options";
import type { LengthPreset } from "@/lib/shared/types";

// What the services charge, so a cost can be shown before it's spent and
// recorded after. Amounts are millionths of a dollar ("micros"); prices are
// dollars per million tokens, so tokens × price comes out in micros.

/** Claude, on the Anthropic API (October 2026). */
const CLAUDE: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-opus-4": { input: 5, output: 25, cacheRead: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-sonnet-4": { input: 3, output: 15, cacheRead: 0.3 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-haiku-4": { input: 1, output: 5, cacheRead: 0.1 },
};

/** The longest name in the table that the model's name starts with ("claude-opus-4-8" → "claude-opus-4"). */
function lookup<T>(table: Record<string, T>, model: string): T | undefined {
  const key = Object.keys(table)
    .filter((k) => model === k || model.startsWith(`${k}-`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? table[key] : undefined;
}

const claudePrices = (model: string) => lookup(CLAUDE, model) ?? CLAUDE["claude-opus-5"];

/** The storyteller's rates, dollars per million tokens, for estimates made in the browser. */
export function storytellerRates(model = config.storyModel): { input: number; output: number } {
  const { input, output } = claudePrices(model);
  return { input, output };
}

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** What one Claude call cost, from the usage it reported (thinking is counted in the output). */
export function claudeCost(model: string, u: ClaudeUsage): number {
  const p = claudePrices(model);
  return Math.round(
    u.input_tokens * p.input +
      u.output_tokens * p.output +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.cache_read_input_tokens ?? 0) * p.cacheRead,
  );
}

/** About what writing a story costs before any have been written: the words, the instructions, the storyteller's thinking. */
export function writeCostGuess(length: LengthPreset, photos = 0, model = config.storyModel): number {
  const p = claudePrices(model);
  const words = LENGTHS[length].minutes * WORDS_PER_MINUTE;
  const input = 7_000 + photos * 1_600;
  const output = Math.round(words * 2.3) + 4_000;
  return Math.round(input * p.input + output * p.output);
}

/** About what planning a picture book costs: the storyteller reads the story and writes a page of notes. */
export function planCostGuess(words: number, pages: number, model = config.storyModel): number {
  const p = claudePrices(model);
  return Math.round((3_000 + words * 1.5) * p.input + (2_500 + pages * 150) * p.output);
}

/**
 * Google's picture models: dollars per million tokens, and the tokens a 2K
 * picture comes to, with room for any words the model adds.
 */
const PICTURES: Record<string, { input: number; output: number; tokens: number }> = {
  "gemini-nano-banana-2.1": { input: 0.5, output: 30, tokens: 1_680 + 320 },
  "gemini-3.1-flash-image": { input: 0.5, output: 60, tokens: 1_680 + 320 },
  "gemini-3-pro-image": { input: 2, output: 120, tokens: 1_120 + 480 },
  "gemini-2.5-flash-image": { input: 0.3, output: 30, tokens: 1_290 + 210 },
};
const UNKNOWN_PICTURE = { input: 2, output: 120, tokens: 2_000 };

/** The words and reference pictures sent with each picture, at most (a few sketches and the cover). */
export const PICTURE_INPUT_TOKENS = 10_000;

const picturePrices = (model: string) => lookup(PICTURES, model) ?? UNKNOWN_PICTURE;

/** The most one picture costs: what's shown, and approved, before any are drawn. */
export function picturePrice(model = config.pictureModel): number {
  const override = config.picturePriceOverride;
  if (override) return Math.round(override * 1_000_000);
  const p = picturePrices(model);
  return Math.round(p.tokens * p.output + PICTURE_INPUT_TOKENS * p.input);
}

/** What one picture cost, from the tokens Google reported. */
export function pictureCost(model: string, usage: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }): number {
  const override = config.picturePriceOverride;
  if (override) return Math.round(override * 1_000_000);
  const p = picturePrices(model);
  const out = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return Math.round(out * p.output + (usage.promptTokenCount ?? 0) * p.input);
}
