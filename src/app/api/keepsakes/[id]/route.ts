import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { deleteKeepsake, updateKeepsake } from "@/lib/server/db";
import { removeHouseholdFile } from "@/lib/server/files";

export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/keepsakes/[id]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const body = await readJson<{ person?: string; title?: string; recordedOn?: string | null }>(req);
  const person = body.person?.trim().slice(0, 40);
  if (body.person !== undefined && !person) throw new HttpError(400, "Whose voice is this?");
  updateKeepsake(c.household.id, id, {
    person,
    title: body.title?.trim().slice(0, 80) || undefined,
    recordedOn: body.recordedOn === undefined ? undefined : body.recordedOn?.trim().slice(0, 40) || null,
  });
  return Response.json({ ok: true });
});

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/keepsakes/[id]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const audioPath = deleteKeepsake(c.household.id, id);
  if (!audioPath) throw new HttpError(404, "That recording is already gone.");
  await removeHouseholdFile(c.household.id, audioPath);
  return Response.json({ ok: true });
});
