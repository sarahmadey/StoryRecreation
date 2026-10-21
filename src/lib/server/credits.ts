import { config } from "./config";
import type { VoiceCredits } from "@/lib/shared/types";

// How much ElevenLabs voice credit the family has left this month, so the cost of a
// story can be weighed before it's made. Asked for at most once a minute.

const CACHE_MS = 60 * 1000;
const globalForCredits = globalThis as unknown as { __credits?: { at: number; credits: VoiceCredits | null } };

export async function voiceCredits(): Promise<VoiceCredits | null> {
  if (!config.elevenLabsKey) {
    // Demo mode pretends, like everything else in it.
    return config.demoMode ? { left: 8_420, used: 1_580, limit: 10_000, resetsAt: Date.now() + 12 * 24 * 3600 * 1000, plan: "demo", demo: true } : null;
  }
  const cached = globalForCredits.__credits;
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.credits;
  let credits: VoiceCredits | null = null;
  try {
    const res = await fetch(`${config.elevenLabsBaseUrl ?? "https://api.elevenlabs.io"}/v1/user/subscription`, {
      headers: { "xi-api-key": config.elevenLabsKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`ElevenLabs said ${res.status}`);
    const s = (await res.json()) as { tier?: string; character_count?: number; character_limit?: number; next_character_count_reset_unix?: number };
    if (typeof s.character_count === "number" && typeof s.character_limit === "number") {
      credits = {
        used: s.character_count,
        limit: s.character_limit,
        left: Math.max(0, s.character_limit - s.character_count),
        resetsAt: s.next_character_count_reset_unix ? s.next_character_count_reset_unix * 1000 : null,
        plan: s.tier ?? "",
      };
    }
  } catch (err) {
    // e.g. a key without permission to read the account: the app works the same, just without the numbers.
    console.warn("Couldn't read the ElevenLabs credit balance:", err instanceof Error ? err.message : err);
  }
  globalForCredits.__credits = { at: Date.now(), credits };
  return credits;
}

/** After a recording, the balance has changed: ask again next time. */
export function forgetVoiceCredits() {
  globalForCredits.__credits = undefined;
}
