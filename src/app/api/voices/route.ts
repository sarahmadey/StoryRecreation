import { apiCtx, route } from "@/lib/server/auth";
import { voiceCatalog } from "@/lib/server/voices";

export const GET = route(async () => {
  const ctx = await apiCtx();
  return Response.json({ voices: await voiceCatalog(ctx.household.id) });
});
