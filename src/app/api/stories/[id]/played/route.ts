import { apiCtx, route } from "@/lib/server/auth";
import { markPlayed } from "@/lib/server/db";

export const POST = route(async (_req: Request, ctx: RouteContext<"/api/stories/[id]/played">) => {
  const c = await apiCtx();
  const { id } = await ctx.params;
  markPlayed(c.household.id, id);
  return Response.json({ ok: true });
});
