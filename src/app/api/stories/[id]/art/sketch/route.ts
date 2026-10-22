import { apiCtx, HttpError, readJson, route } from "@/lib/server/auth";
import { getStory } from "@/lib/server/db";
import { artBusy, startSketches } from "@/lib/server/art";
import { illustratorReady } from "@/lib/server/illustrator";
import { picturePrice } from "@/lib/server/prices";
import { approvePurchase, recordSpend, type Approval } from "@/lib/server/spending";
import { SKETCHES } from "@/lib/shared/art";

/** Sketch a character a few times, for the family to choose between. A purchase: approved with the PIN. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/art/sketch">) => {
  const c = await apiCtx();
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story?.art) throw new HttpError(404, "This story isn't a picture book yet.");
  const body = await readJson<{ characterId?: unknown; approval?: Approval }>(req);
  const character = story.art.characters.find((x) => x.id === body.characterId);
  if (!character) throw new HttpError(404, "That character wasn't found.");
  if (artBusy(id)) throw new HttpError(409, "The illustrator is busy with this book. Try again in a moment.");

  const real = illustratorReady();
  const price = (real ? picturePrice() : 0) * SKETCHES;
  approvePurchase(c, body.approval, price);
  const purchaseId = recordSpend(c.household.id, {
    storyId: id,
    service: "pictures",
    kind: "sketch",
    what: `Sketched ${character.name} for “${story.title}” (${SKETCHES} tries)`,
    approved: price,
    standIn: !real,
  });
  startSketches(id, character.id, purchaseId, SKETCHES);
  return Response.json({ story: getStory(c.household.id, id) });
});
