import { apiCtx, HttpError, readJson, route } from "@/lib/server/auth";
import { getStory } from "@/lib/server/db";
import { artBusy, startSketches } from "@/lib/server/art";
import { illustratorReady } from "@/lib/server/illustrator";
import { picturePrice } from "@/lib/server/prices";
import { approvePurchase, recordSpend, type Approval } from "@/lib/server/spending";
import { SKETCHES } from "@/lib/shared/art";

/**
 * Sketch characters a couple of times each, for the family to choose between: everyone chosen at once
 * (`characterIds`), or one character (`characterId`). One purchase, approved once.
 */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/art/sketch">) => {
  const c = await apiCtx();
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story?.art) throw new HttpError(404, "This story isn't a picture book yet.");
  const body = await readJson<{ characterId?: unknown; characterIds?: unknown; approval?: Approval }>(req);
  const asked = Array.isArray(body.characterIds) ? body.characterIds : [body.characterId];
  const cast = story.art.characters.filter((x) => asked.includes(x.id));
  if (!cast.length) throw new HttpError(404, "That character wasn't found.");
  if (artBusy(id)) throw new HttpError(409, "The illustrator is busy with this book. Try again in a moment.");

  const real = illustratorReady();
  const price = (real ? picturePrice() : 0) * SKETCHES * cast.length;
  approvePurchase(c, body.approval, price);
  const names = cast.map((x) => x.name);
  const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  const purchaseId = recordSpend(c.household.id, {
    storyId: id,
    service: "pictures",
    kind: "sketch",
    what: `Sketched ${who} for “${story.title}” (${SKETCHES} ${cast.length > 1 ? "each" : "tries"})`,
    approved: price,
    standIn: !real,
  });
  startSketches(id, cast.flatMap((x) => Array.from({ length: SKETCHES }, () => x.id)), purchaseId);
  return Response.json({ story: getStory(c.household.id, id) });
});
