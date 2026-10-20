import { apiCtx, route } from "@/lib/server/auth";
import { favoriteVoiceIds } from "@/lib/server/db";
import { voiceCatalog } from "@/lib/server/voices";

export const GET = route(async () => {
  const ctx = await apiCtx();
  const favorites = favoriteVoiceIds(ctx.household.id);
  const voices = await voiceCatalog(ctx.household.id);
  return Response.json({ voices: voices.map((v) => (favorites.has(v.voiceId) ? { ...v, favorite: true } : v)) });
});
