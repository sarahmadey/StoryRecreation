import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { designVoicePreviews, elevenLabsReason } from "@/lib/server/performer";
import { VOICE_SAMPLES, languageOf, speaksLanguage } from "@/lib/shared/languages";

/** Conjure three candidate voices from a description ("a tiny, squeaky mouse"), speaking English, French or Spanish. */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  if (!config.elevenLabsKey) throw new HttpError(503, "Designing voices needs an ElevenLabs API key.", "no_voices");
  const body = await readJson<{ description?: string; sampleText?: string; language?: string }>(req);
  const desc = body.description?.trim();
  if (!desc || desc.length < 20) throw new HttpError(400, "Describe the voice in a little more detail (20+ letters).");
  // A voice for stories in another language is made speaking it, so it has a natural accent.
  const language = languageOf(body.language);
  const sample = language === "en" ? body.sampleText : VOICE_SAMPLES[language];
  try {
    return Response.json({ previews: await designVoicePreviews(speaksLanguage(desc, language).slice(0, 1000), sample) });
  } catch (err) {
    console.error(err);
    throw new HttpError(502, elevenLabsReason(err) ?? "The voice workshop is closed right now. Please try again.");
  }
});
