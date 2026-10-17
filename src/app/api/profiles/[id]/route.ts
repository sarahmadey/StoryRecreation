import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { deleteProfile, getProfile, updateProfile } from "@/lib/server/db";
import { AVATARS, PROFILE_COLORS } from "@/lib/shared/options";

export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/profiles/[id]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  if (!getProfile(c.household.id, id)) throw new HttpError(404, "That reader wasn't found.");
  const body = await readJson<{ name?: string; avatar?: string; color?: string; age?: number | null }>(req);
  updateProfile(c.household.id, id, {
    ...(body.name?.trim() ? { name: body.name.trim().slice(0, 30) } : {}),
    ...(body.avatar && AVATARS.includes(body.avatar) ? { avatar: body.avatar } : {}),
    ...(body.color && PROFILE_COLORS.includes(body.color) ? { color: body.color } : {}),
    ...(body.age === null || typeof body.age === "number" ? { age: body.age } : {}),
  });
  return Response.json({ profile: getProfile(c.household.id, id) });
});

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/profiles/[id]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  deleteProfile(c.household.id, id);
  return Response.json({ ok: true });
});
