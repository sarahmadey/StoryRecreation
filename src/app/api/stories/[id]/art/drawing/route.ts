import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { changeStoryArt, getStory } from "@/lib/server/db";
import { saveImage } from "@/lib/server/files";

/** A child's own drawing of a character: the sketches are then made from it. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/art/drawing">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story?.art) throw new HttpError(404, "This story isn't a picture book yet.");
  const form = await req.formData();
  const characterId = String(form.get("characterId") ?? "");
  if (!story.art.characters.some((ch) => ch.id === characterId)) throw new HttpError(404, "That character wasn't found.");
  const picture = form.get("picture");
  if (!(picture instanceof File) || picture.size === 0) throw new HttpError(400, "Choose a photo of the drawing first.");
  const rel = await saveImage(c.household.id, `stories/${id}/art`, picture);
  changeStoryArt(id, (a) => a && { ...a, characters: a.characters.map((ch) => (ch.id === characterId ? { ...ch, drawing: rel } : ch)) });
  return Response.json({ story: getStory(c.household.id, id) });
});
