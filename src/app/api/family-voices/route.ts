import fs from "node:fs";
import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { keepsakeFiles, newId, saveFamilyVoice } from "@/lib/server/db";
import { resolveHouseholdPath } from "@/lib/server/files";
import { cloneFamilyVoice, elevenLabsReason } from "@/lib/server/performer";
import { forgetVoiceCache } from "@/lib/server/voices";

const MIN_MS = 10_000;

// Teach the storytellers a grown-up's voice from their keepsake recordings.
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const body = await readJson<{ name?: string; keepsakeIds?: string[]; adult?: boolean; consent?: boolean; cleanNoise?: boolean }>(req);
  const ids = [...new Set((body.keepsakeIds ?? []).filter((x) => typeof x === "string"))].slice(0, 25);
  const files = keepsakeFiles(ctx.household.id, ids);
  if (!files.length) throw new HttpError(400, "Choose at least one recording.");
  if (body.adult !== true) throw new HttpError(400, "Storytelling voices can only be made from a grown-up's voice.");
  if (body.consent !== true) throw new HttpError(400, "Please confirm you have the right to use this voice.");
  const totalMs = files.reduce((n, f) => n + f.durationMs, 0);
  if (totalMs < MIN_MS) throw new HttpError(400, "We need at least 10 seconds of their voice. A minute or more sounds best.");
  const person = files[0].person;
  const name = body.name?.trim().slice(0, 40) || person;

  let voiceId: string;
  if (config.elevenLabsKey) {
    try {
      const audio = await Promise.all(
        files.map(async (f, i) => ({ data: await fs.promises.readFile(resolveHouseholdPath(ctx.household.id, f.audioPath)), filename: `recording-${i + 1}.mp3` })),
      );
      voiceId = await cloneFamilyVoice(name, person, audio, body.cleanNoise !== false);
    } catch (err) {
      console.error(err);
      throw new HttpError(502, elevenLabsReason(err) ?? "ElevenLabs couldn't learn this voice. Your plan may not include voice cloning, or may be out of voice slots.");
    }
  } else if (config.demoMode) {
    voiceId = `family-demo-${newId()}`; // a pretend voice: demo mode hums every part
  } else {
    throw new HttpError(503, "Making a family voice needs an ElevenLabs API key.", "no_voices");
  }
  saveFamilyVoice(ctx.household.id, { voiceId, name, person, keepsakeIds: files.map((f) => f.id) });
  forgetVoiceCache();
  return Response.json({ voiceId, name });
});
