import path from "node:path";
import type { AppStatus } from "@/lib/shared/types";

export const config = {
  get dataDir(): string {
    // Runtime data, not part of the build: keep the bundler from tracing it.
    return path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data"));
  },
  get demoMode(): boolean {
    return process.env.DEMO_MODE === "1" || process.env.DEMO_MODE === "true";
  },
  get anthropicKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY || undefined;
  },
  get elevenLabsKey(): string | undefined {
    return process.env.ELEVENLABS_API_KEY || undefined;
  },
  get storyModel(): string {
    return process.env.STORY_MODEL || "claude-opus-5-5";
  },
  get voiceModel(): string {
    return process.env.VOICE_MODEL || "eleven_v4";
  },
  /** e.g. an ElevenLabs data-residency endpoint; defaults to the global API. */
  get elevenLabsBaseUrl(): string | undefined {
    return process.env.ELEVENLABS_BASE_URL || undefined;
  },
  get secureCookies(): boolean {
    return process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1";
  },
};

/** Which engines are live. In demo mode, stand-ins are used for anything missing. */
export function appStatus(): AppStatus {
  return {
    demoMode: config.demoMode,
    storyteller: Boolean(config.anthropicKey),
    voices: Boolean(config.elevenLabsKey),
    storyModel: config.storyModel,
    voiceModel: config.voiceModel,
  };
}

export function canWriteStories(): boolean {
  return Boolean(config.anthropicKey) || config.demoMode;
}

export function canRecordStories(): boolean {
  return Boolean(config.elevenLabsKey) || config.demoMode;
}
