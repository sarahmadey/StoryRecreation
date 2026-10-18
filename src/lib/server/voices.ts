import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { config } from "./config";
import { listDesignedVoices, listFamilyVoices } from "./db";
import { PERSONAS, personaFor, personaVoiceOptions } from "@/lib/shared/personas";
import type { VoiceOption } from "@/lib/shared/types";

const globalForEleven = globalThis as unknown as {
  __eleven?: ElevenLabsClient;
  __voiceCache?: { at: number; voices: VoiceOption[] };
};

export function eleven(): ElevenLabsClient {
  if (!config.elevenLabsKey) throw new Error("ELEVENLABS_API_KEY is not set");
  globalForEleven.__eleven ??= new ElevenLabsClient({ apiKey: config.elevenLabsKey, baseUrl: config.elevenLabsBaseUrl });
  return globalForEleven.__eleven;
}

const CACHE_MS = 10 * 60 * 1000;

/** Voices on the ElevenLabs account: the defaults plus anything the family added. */
async function accountVoices(): Promise<VoiceOption[]> {
  const cached = globalForEleven.__voiceCache;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.voices;

  const voices: VoiceOption[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await eleven().voices.search({ pageSize: 100, nextPageToken: pageToken });
    for (const v of res.voices) {
      const labels = v.labels ?? {};
      const persona = personaFor(v.voiceId);
      voices.push({
        voiceId: v.voiceId,
        name: v.name ?? "Unnamed voice",
        description:
          [labels.descriptive, labels.description, labels.use_case, v.description].filter(Boolean).join(", ").slice(0, 160) ||
          persona?.description ||
          "",
        gender: labels.gender ?? persona?.gender ?? null,
        age: labels.age ?? persona?.age ?? null,
        accent: labels.accent ?? persona?.accent ?? null,
        previewUrl: v.previewUrl ?? null,
        persona: persona ? { name: persona.name, emoji: persona.emoji, tagline: persona.tagline } : null,
        source: v.category === "premade" ? "default" : "account",
      });
    }
    if (!res.hasMore || !res.nextPageToken) break;
    pageToken = res.nextPageToken;
  }
  globalForEleven.__voiceCache = { at: Date.now(), voices };
  return voices;
}

export function forgetVoiceCache() {
  globalForEleven.__voiceCache = undefined;
}

/**
 * Every voice this family can cast. Personas come first (in their storybook
 * order), then designed voices, then the rest of the account's voices.
 */
export async function voiceCatalog(householdId: string): Promise<VoiceOption[]> {
  const designed = listDesignedVoices(householdId);
  const family = listFamilyVoices(householdId);
  let base: VoiceOption[];
  if (config.elevenLabsKey) {
    try {
      base = await accountVoices();
    } catch (err) {
      console.error("Could not list ElevenLabs voices", err);
      base = personaVoiceOptions();
    }
  } else {
    base = personaVoiceOptions();
  }

  const byId = new Map(base.map((v) => [v.voiceId, v]));
  for (const d of designed) {
    const existing = byId.get(d.voiceId);
    byId.set(d.voiceId, {
      ...(existing ?? { gender: null, age: null, accent: null, previewUrl: null, persona: null }),
      voiceId: d.voiceId,
      name: d.name,
      description: d.description,
      source: "designed",
    });
  }

  for (const f of family) {
    byId.set(f.voiceId, {
      voiceId: f.voiceId,
      name: f.name,
      description: `${f.person}, in their own voice`,
      gender: null,
      age: null,
      accent: null,
      previewUrl: f.previewUrl,
      persona: null,
      source: "family",
    });
  }

  const personaOrder = new Map(PERSONAS.map((p, i) => [p.voiceId, i]));
  const rank = (v: VoiceOption) =>
    v.source === "family" ? -1 : personaOrder.has(v.voiceId) ? personaOrder.get(v.voiceId)! : v.source === "designed" ? 100 : 200;
  return [...byId.values()].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/**
 * The voices the storyteller may cast. A family voice reads only when the
 * family picks it as the storyteller: Grandma never turns up as the troll.
 */
export function castableVoices(voices: VoiceOption[], narratorVoiceId: string | null | undefined): VoiceOption[] {
  return voices.filter((v) => v.source !== "family" || v.voiceId === narratorVoiceId);
}

export function describeVoiceForCasting(v: VoiceOption): string {
  const traits = [v.gender, v.age?.replace("_", " "), v.accent].filter(Boolean).join(", ");
  const label = v.persona ? `${v.name} ("${v.persona.name}")` : v.name;
  return `- ${v.voiceId}: ${label}. ${traits}${traits && v.description ? ". " : ""}${v.description}${
    v.source === "designed" ? " [custom character voice]" : v.source === "family" ? " [a family member's own voice: the storyteller only, never a character]" : ""
  }`;
}
