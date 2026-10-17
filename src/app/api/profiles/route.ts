import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { createProfile, listProfiles } from "@/lib/server/db";
import { AVATARS, PROFILE_COLORS } from "@/lib/shared/options";

export const GET = route(async () => {
  const ctx = await apiCtx();
  return Response.json({ profiles: listProfiles(ctx.household.id), current: ctx.profile?.id ?? null });
});

export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const body = await readJson<{ name?: string; avatar?: string; color?: string; age?: number | null }>(req);
  const name = body.name?.trim().slice(0, 30);
  if (!name) throw new HttpError(400, "Every reader needs a name.");
  const existing = listProfiles(ctx.household.id);
  if (existing.length >= 12) throw new HttpError(400, "That's a lot of readers! Twelve is the limit.");
  const profile = createProfile(ctx.household.id, {
    name,
    avatar: AVATARS.includes(body.avatar ?? "") ? body.avatar! : AVATARS[existing.length % AVATARS.length],
    color: PROFILE_COLORS.includes(body.color ?? "") ? body.color! : PROFILE_COLORS[existing.length % PROFILE_COLORS.length],
    age: typeof body.age === "number" && body.age >= 0 && body.age < 120 ? Math.round(body.age) : null,
  });
  return Response.json({ profile });
});
