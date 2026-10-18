import { ElevenLabsError } from "@elevenlabs/elevenlabs-js";
import { config } from "./config";
import { eleven } from "./voices";
import { chunkLines, speakable } from "./text";
import { concatClips, demoAmbience, demoVoiceClip, pcm16ToFloat, SAMPLE_RATE, type Clip } from "./audio";
import type { CastMember, ScriptLine, TimelineWord } from "@/lib/shared/types";

// The performer turns script lines into audio using ElevenLabs Text to
// Dialogue, which performs a multi-voice scene in one pass with natural
// turn-taking and honours [delivery tags]. It also returns character
// timings, which power the read-along word highlighting.

const OUTPUT = "pcm_24000" as const;

export class PerformerError extends Error {}

function useDemo(): boolean {
  return !config.elevenLabsKey && config.demoMode;
}

export async function performLines(lines: ScriptLine[], cast: CastMember[]): Promise<Clip> {
  const voiceOf = (speaker: string) =>
    cast.find((c) => c.id === speaker)?.voiceId ?? cast.find((c) => c.id === "narrator")?.voiceId ?? cast[0]?.voiceId;
  const spoken = lines.filter((l) => speakable(l.text).length > 0);
  if (!spoken.length) return { samples: new Float32Array(0), words: [] };

  if (useDemo()) {
    return demoVoiceClip(spoken.map((l) => ({ ...l, voiceId: voiceOf(l.speaker) ?? "demo" })));
  }

  const clips: Clip[] = [];
  for (const chunk of chunkLines(spoken)) clips.push(await performChunk(chunk, voiceOf));
  return concatClips(clips, 0.25);
}

async function performChunk(lines: ScriptLine[], voiceOf: (s: string) => string | undefined): Promise<Clip> {
  const inputs = lines.map((l) => ({ text: l.text, voiceId: voiceOf(l.speaker)! }));
  try {
    const res = await withRetry(() =>
      eleven().textToDialogue.convertWithTimestamps({
        inputs,
        modelId: config.voiceModel,
        outputFormat: OUTPUT,
      }),
    );
    const samples = pcm16ToFloat(Buffer.from(res.audioBase64, "base64"));
    const speakerAt = (charIndex: number) => {
      const seg = res.voiceSegments.find((s) => charIndex >= s.characterStartIndex && charIndex < s.characterEndIndex);
      return lines[seg?.dialogueInputIndex ?? 0]?.speaker ?? "narrator";
    };
    const words = res.alignment ? wordsFromAlignment(res.alignment, speakerAt) : [];
    return { samples, words };
  } catch (err) {
    // Some plans or models may not offer dialogue; perform line by line instead.
    if (err instanceof ElevenLabsError && (err.statusCode === 400 || err.statusCode === 403 || err.statusCode === 422)) {
      console.warn("Dialogue unavailable, performing line by line:", err.message);
      return performLineByLine(lines, voiceOf);
    }
    throw explain(err);
  }
}

async function performLineByLine(lines: ScriptLine[], voiceOf: (s: string) => string | undefined): Promise<Clip> {
  const clips: Clip[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    try {
      const res = await withRetry(() =>
        eleven().textToSpeech.convertWithTimestamps(voiceOf(line.speaker)!, {
          text: line.text,
          modelId: config.voiceModel,
          outputFormat: OUTPUT,
        }),
      );
      const samples = pcm16ToFloat(Buffer.from(res.audioBase64, "base64"));
      clips.push({ samples, words: res.alignment ? wordsFromAlignment(res.alignment, () => line.speaker) : [] });
    } catch (err) {
      throw explain(err);
    }
  }
  return concatClips(clips, 0.3);
}

/** Group per-character timings into words, skipping [delivery tags]. */
export function wordsFromAlignment(
  a: { characters: string[]; characterStartTimesSeconds: number[]; characterEndTimesSeconds: number[] },
  speakerAt: (charIndex: number) => string,
): TimelineWord[] {
  const words: TimelineWord[] = [];
  let cur = "";
  let start = 0;
  let end = 0;
  let firstIndex = 0;
  let inTag = false;
  const flush = () => {
    const w = cur.trim();
    if (w && /[\p{L}\p{N}]/u.test(w)) words.push({ t: start, e: end, w, speaker: speakerAt(firstIndex) });
    cur = "";
  };
  a.characters.forEach((ch, i) => {
    if (ch === "[") {
      flush();
      inTag = true;
      return;
    }
    if (inTag) {
      if (ch === "]") inTag = false;
      return;
    }
    if (/\s/.test(ch)) {
      flush();
      return;
    }
    if (!cur) {
      start = a.characterStartTimesSeconds[i] ?? end;
      firstIndex = i;
    }
    cur += ch;
    end = a.characterEndTimesSeconds[i] ?? start;
  });
  flush();
  return words;
}

/** A gentle, seamlessly looping soundscape to sit under the story. */
export async function performAmbience(description: string): Promise<Float32Array | null> {
  if (!description.trim()) return null;
  if (useDemo()) return demoAmbience();
  try {
    const stream = await withRetry(() =>
      eleven().textToSoundEffects.convert({
        text: `${description}. Gentle, quiet, calm, continuous ambience for a bedtime story, no music, no voices, no sudden sounds.`,
        loop: true,
        durationSeconds: 20,
        promptInfluence: 0.45,
        outputFormat: OUTPUT,
      }),
    );
    return pcm16ToFloat(await readAll(stream));
  } catch (err) {
    console.warn("Ambience unavailable:", err);
    return null; // a story without ambience is still a lovely story
  }
}

export async function designVoicePreviews(description: string, sampleText?: string) {
  const res = await withRetry(() =>
    eleven().textToVoice.design({
      voiceDescription: description,
      modelId: "eleven_ttv_v3",
      ...(sampleText && sampleText.length >= 100 ? { text: sampleText.slice(0, 1000) } : { autoGenerateText: true }),
    }),
  );
  return res.previews.slice(0, 3).map((p) => ({
    generatedVoiceId: p.generatedVoiceId,
    audio: `data:${p.mediaType || "audio/mpeg"};base64,${p.audioBase64}`,
  }));
}

export async function saveDesignedVoice(generatedVoiceId: string, name: string, description: string): Promise<string> {
  const voice = await withRetry(() =>
    eleven().textToVoice.create({
      voiceName: `Storyhollow · ${name}`.slice(0, 60),
      voiceDescription: description.slice(0, 1000),
      generatedVoiceId,
      labels: { source: "storyhollow" },
    }),
  );
  return voice.voiceId;
}

/**
 * Learn a grown-up's voice from their recordings (ElevenLabs Instant Voice
 * Cloning), returning the new voice id. Old voicemails are often noisy, so
 * background noise is cleaned up unless the family turns that off.
 */
export async function cloneFamilyVoice(
  name: string,
  person: string,
  files: { data: Buffer; filename: string }[],
  cleanNoise: boolean,
): Promise<string> {
  const voice = await withRetry(() =>
    eleven().voices.ivc.create({
      name: `Storyhollow · ${name}`.slice(0, 60),
      description: `${person}, in their own voice, for family stories.`.slice(0, 500),
      files: files.map((f) => ({ data: f.data, filename: f.filename, contentType: "audio/mpeg" })),
      removeBackgroundNoise: cleanNoise,
      labels: { source: "storyhollow-family" },
    }),
  );
  return voice.voiceId;
}

/** Remove a voice from the ElevenLabs account, freeing its slot. */
export async function deleteAccountVoice(voiceId: string): Promise<void> {
  await eleven().voices.delete(voiceId);
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = err instanceof ElevenLabsError ? err.statusCode : undefined;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 1500 * 2 ** i));
    }
  }
  throw lastErr;
}

function explain(err: unknown): Error {
  if (err instanceof ElevenLabsError) {
    if (err.statusCode === 401) return new PerformerError("The ElevenLabs API key was not accepted.");
    if (err.statusCode === 402 || err.statusCode === 429)
      return new PerformerError("ElevenLabs says we're out of voice credits or going too fast. Try again later.");
    return new PerformerError(`The voices hit a snag (${err.statusCode ?? "network"}). Please try again.`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export { SAMPLE_RATE };
