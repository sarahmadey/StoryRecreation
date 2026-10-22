import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { changeStoryArt, getStory, updateStory } from "@/lib/server/db";
import { canWriteStories } from "@/lib/server/config";
import { startPictureBook } from "@/lib/server/art";
import { ART_STYLES, DEFAULT_ART_STYLE } from "@/lib/shared/art";
import type { ArtStyle } from "@/lib/shared/types";

const styleOf = (v: unknown): ArtStyle => (typeof v === "string" && v in ART_STYLES ? (v as ArtStyle) : DEFAULT_ART_STYLE);

/** Make a story into a picture book (or start its pictures over): the storyteller reads it and plans the pictures. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/art">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story) throw new HttpError(404, "That story wasn't found.");
  if (story.mode !== "create" || story.settings.source !== "idea") throw new HttpError(400, "Pictures are drawn for stories dreamed up from an idea.");
  if (!story.script || story.status === "writing") throw new HttpError(409, "Please wait until the story has been written.");
  if (!canWriteStories()) throw new HttpError(503, "Planning the pictures needs the storyteller (an Anthropic key).", "no_storyteller");
  const { style } = await readJson<{ style?: unknown }>(req);
  if (!startPictureBook(id, styleOf(style))) throw new HttpError(409, "The illustrator is busy with this book. Try again in a moment.");
  return Response.json({ story: getStory(c.household.id, id) });
});

/** Change the style, what a character looks like, or which sketch is them. */
export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/art">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story?.art) throw new HttpError(404, "This story isn't a picture book yet.");
  const body = await readJson<{ style?: unknown; looks?: Record<string, unknown>; choose?: { characterId?: unknown; index?: unknown } }>(req);
  const looks = body.looks && typeof body.looks === "object" ? body.looks : {};
  const choose = body.choose;
  changeStoryArt(id, (a) => {
    if (!a) return a;
    return {
      ...a,
      style: body.style === undefined ? a.style : styleOf(body.style),
      characters: a.characters.map((ch) => {
        const look = looks[ch.id];
        const index = Number(choose?.index);
        return {
          ...ch,
          look: typeof look === "string" ? look.trim().slice(0, 500) : ch.look,
          chosen: choose?.characterId === ch.id && Number.isInteger(index) && index >= 0 && index < ch.sketches.length ? index : ch.chosen,
        };
      }),
    };
  });
  if (body.style !== undefined) updateStory(id, { settings: { ...story.settings, artStyle: styleOf(body.style) } });
  return Response.json({ story: getStory(c.household.id, id) });
});
