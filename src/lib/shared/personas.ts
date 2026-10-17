import type { VoiceOption } from "./types";

/**
 * Storybook personas for ElevenLabs' default voices. Kids pick a *character*
 * ("Professor Hoot") rather than a voice name. When an ElevenLabs key is set,
 * the live voice list from the account is used and personas whose voice is not
 * available are hidden automatically.
 */
export interface Persona {
  voiceId: string;
  voiceName: string;
  name: string;
  emoji: string;
  tagline: string;
  gender: "male" | "female" | "neutral";
  age: "young" | "middle_aged" | "old";
  accent: string;
  description: string;
  narrator: boolean;
}

export const PERSONAS: Persona[] = [
  {
    voiceId: "JBFqnCBsd6RMkjVDRZzb",
    voiceName: "George",
    name: "Professor Hoot",
    emoji: "🦉",
    tagline: "A warm storyteller by the fire",
    gender: "male",
    age: "middle_aged",
    accent: "british",
    description: "warm, rich, gently theatrical British storyteller",
    narrator: true,
  },
  {
    voiceId: "pFZP5JQG7iQjIQuC4Bku",
    voiceName: "Lily",
    name: "Granny Willow",
    emoji: "🌿",
    tagline: "Soft, kind and a little bit magical",
    gender: "female",
    age: "middle_aged",
    accent: "british",
    description: "soft, velvety, kind British woman",
    narrator: true,
  },
  {
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    voiceName: "Sarah",
    name: "Luna",
    emoji: "🌙",
    tagline: "Gentle and soothing, perfect for bedtime",
    gender: "female",
    age: "young",
    accent: "american",
    description: "soft, reassuring young American woman",
    narrator: true,
  },
  {
    voiceId: "XrExE9yKIg1WjnnlVkGX",
    voiceName: "Matilda",
    name: "Miss Marigold",
    emoji: "🌼",
    tagline: "Bright, friendly and full of wonder",
    gender: "female",
    age: "middle_aged",
    accent: "american",
    description: "friendly, warm, upbeat American woman",
    narrator: true,
  },
  {
    voiceId: "onwK4e9ZLuTAKqWW03F9",
    voiceName: "Daniel",
    name: "Sir Reginald",
    emoji: "🎩",
    tagline: "A grand voice for big adventures",
    gender: "male",
    age: "middle_aged",
    accent: "british",
    description: "deep, dignified, authoritative British man",
    narrator: true,
  },
  {
    voiceId: "pqHfZKP75CvOlQylNhV4",
    voiceName: "Bill",
    name: "Grandpa Oak",
    emoji: "🌳",
    tagline: "A kindly old grandfather",
    gender: "male",
    age: "old",
    accent: "american",
    description: "old, wise, trustworthy American grandfather",
    narrator: true,
  },
  {
    voiceId: "N2lVS1w4EtoT3dr4eOWO",
    voiceName: "Callum",
    name: "Captain Bramble",
    emoji: "🏴‍☠️",
    tagline: "A gruff, twinkly-eyed sea captain",
    gender: "male",
    age: "middle_aged",
    accent: "transatlantic",
    description: "husky, gravelly, characterful man",
    narrator: false,
  },
  {
    voiceId: "cgSgspJ2msm6clMCkdW9",
    voiceName: "Jessica",
    name: "Pip",
    emoji: "⭐",
    tagline: "Playful, giggly and quick",
    gender: "female",
    age: "young",
    accent: "american",
    description: "playful, bright, expressive young woman",
    narrator: false,
  },
  {
    voiceId: "IKne3meq5aSn9XLyUdCD",
    voiceName: "Charlie",
    name: "Ranger Charlie",
    emoji: "🦘",
    tagline: "A cheerful Aussie explorer",
    gender: "male",
    age: "middle_aged",
    accent: "australian",
    description: "casual, cheerful Australian man",
    narrator: false,
  },
  {
    voiceId: "SAz9YHcvj6GT2YYXdXww",
    voiceName: "River",
    name: "Wren",
    emoji: "🍃",
    tagline: "Calm and dreamy",
    gender: "neutral",
    age: "middle_aged",
    accent: "american",
    description: "calm, relaxed, neutral voice",
    narrator: true,
  },
  {
    voiceId: "nPczCjzI2devNBz1zQrb",
    voiceName: "Brian",
    name: "Big Bear Bruno",
    emoji: "🐻",
    tagline: "Deep, rumbly and cuddly",
    gender: "male",
    age: "middle_aged",
    accent: "american",
    description: "deep, resonant, comforting American man",
    narrator: false,
  },
  {
    voiceId: "Xb7hH8MSUJpSbSDYk0k2",
    voiceName: "Alice",
    name: "Queen Clementine",
    emoji: "👑",
    tagline: "Clear, confident and regal",
    gender: "female",
    age: "middle_aged",
    accent: "british",
    description: "clear, confident British woman",
    narrator: false,
  },
  {
    voiceId: "TX3LPaxmHKxFdv7VOQHJ",
    voiceName: "Liam",
    name: "Jasper",
    emoji: "🪁",
    tagline: "An eager young hero",
    gender: "male",
    age: "young",
    accent: "american",
    description: "energetic, earnest young American man",
    narrator: false,
  },
  {
    voiceId: "FGY2WhTYpPnrIDTdsKH5",
    voiceName: "Laura",
    name: "Daisy",
    emoji: "🌸",
    tagline: "Sunny and sparkly",
    gender: "female",
    age: "young",
    accent: "american",
    description: "upbeat, quirky young American woman",
    narrator: false,
  },
  {
    voiceId: "CwhRBWXzGAHq8TQ4Fs17",
    voiceName: "Roger",
    name: "Mayor Rumble",
    emoji: "🎺",
    tagline: "Bold and booming",
    gender: "male",
    age: "middle_aged",
    accent: "american",
    description: "confident, easygoing American man",
    narrator: false,
  },
];

export const DEFAULT_NARRATOR_ID = PERSONAS[0].voiceId;

export function personaFor(voiceId: string): Persona | undefined {
  return PERSONAS.find((p) => p.voiceId === voiceId);
}

export function personaVoiceOptions(): VoiceOption[] {
  return PERSONAS.map((p) => ({
    voiceId: p.voiceId,
    name: p.voiceName,
    description: p.description,
    gender: p.gender,
    age: p.age,
    accent: p.accent,
    previewUrl: null,
    persona: { name: p.name, emoji: p.emoji, tagline: p.tagline },
    source: "default" as const,
  }));
}
