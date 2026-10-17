import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { getStory, updateStory } from "@/lib/server/db";
import { isRunning, remixStory, startRecording } from "@/lib/server/jobs";
import { sanitizeSettings } from "@/lib/server/settings";
import type { StorySettings } from "@/lib/shared/types";

/** Change the chime or the page-turn pause without re-recording the voices. */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/remix">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story) throw new HttpError(404, "That story wasn't found.");
  if (isRunning(id)) throw new HttpError(409, "Please wait until the storyteller has finished.");
  const body = await readJson<{ chime?: StorySettings["chime"]; ambience?: boolean }>(req);
  const settings = sanitizeSettings({ ...story.settings, chime: body.chime ?? story.settings.chime, ambience: body.ambience ?? story.settings.ambience });
  updateStory(id, { settings });
  if (await remixStory(id)) return Response.json({ story: getStory(c.household.id, id) });
  // Something new is needed (e.g. ambience was switched on): record what's missing.
  startRecording(id);
  return Response.json({ story: getStory(c.household.id, id), recording: true });
});
