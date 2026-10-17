import { apiCtx, HttpError, readJson, route } from "@/lib/server/auth";
import { getProfile, setSessionProfile } from "@/lib/server/db";

export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  const { profileId } = await readJson<{ profileId?: string | null }>(req);
  if (profileId && !getProfile(ctx.household.id, profileId)) throw new HttpError(404, "That reader wasn't found.");
  setSessionProfile(ctx.session.id, profileId ?? null);
  return Response.json({ ok: true });
});
