import { apiCtx, route } from "@/lib/server/auth";
import { voiceCredits } from "@/lib/server/credits";

/** How much ElevenLabs voice credit is left this month, or null when it can't be told. */
export const GET = route(async () => {
  await apiCtx();
  return Response.json({ credits: await voiceCredits() });
});
