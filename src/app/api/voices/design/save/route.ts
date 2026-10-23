import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { saveDesignedVoice as saveVoiceRow } from "@/lib/server/db";
import { elevenLabsReason, saveDesignedVoice } from "@/lib/server/performer";
import { forgetVoiceCache } from "@/lib/server/voices";
import { languageOf, speaksLanguage } from "@/lib/shared/languages";

export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  if (!config.elevenLabsKey) throw new HttpError(503, "Designing voices needs an ElevenLabs API key.", "no_voices");
  const body = await readJson<{ generatedVoiceId?: string; name?: string; description?: string; language?: string }>(req);
  const name = body.name?.trim().slice(0, 40);
  if (!body.generatedVoiceId || !name || !body.description) throw new HttpError(400, "Pick a voice and give it a name.");
  // Its description says the language it speaks, so the storyteller casts it for stories in that language.
  const description = speaksLanguage(body.description.trim(), languageOf(body.language));
  try {
    const voiceId = await saveDesignedVoice(body.generatedVoiceId, name, description);
    saveVoiceRow(ctx.household.id, { voiceId, name, description: description.slice(0, 300) });
    forgetVoiceCache();
    return Response.json({ voiceId });
  } catch (err) {
    console.error(err);
    throw new HttpError(502, elevenLabsReason(err) ?? "That voice couldn't be saved. Your ElevenLabs plan may be out of voice slots.");
  }
});
