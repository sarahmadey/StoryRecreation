import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { designVoicePreviews, elevenLabsReason } from "@/lib/server/performer";

/** Conjure three candidate voices from a description ("a tiny, squeaky mouse"). */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  if (!config.elevenLabsKey) throw new HttpError(503, "Designing voices needs an ElevenLabs API key.", "no_voices");
  const { description, sampleText } = await readJson<{ description?: string; sampleText?: string }>(req);
  const desc = description?.trim().slice(0, 1000);
  if (!desc || desc.length < 20) throw new HttpError(400, "Describe the voice in a little more detail (20+ letters).");
  try {
    return Response.json({ previews: await designVoicePreviews(desc, sampleText) });
  } catch (err) {
    console.error(err);
    throw new HttpError(502, elevenLabsReason(err) ?? "The voice workshop is closed right now. Please try again.");
  }
});
