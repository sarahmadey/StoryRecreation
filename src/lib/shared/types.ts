// Shapes shared by the server, the API routes and the browser.

export type BookKind =
  | "shadow_book" // a projector / flashlight book: pages are silhouettes
  | "picture_book" // a physical picture book you own
  | "wild" // photos of something you saw out in the world
  | "idea" // a story dreamed up from a description alone
  | "classic" // a public-domain book from Project Gutenberg
  | "own_text"; // text you pasted in (a poem, a letter from Grandma...)

export type StoryMode = "create" | "read";

export type StoryStatus = "writing" | "draft" | "recording" | "ready" | "error";

export type Mood = "bedtime" | "silly" | "adventure" | "mystery" | "heartwarming" | "spooky";
export type LengthPreset = "short" | "medium" | "long";
export type AgeBand = "2-3" | "4-5" | "6-8" | "9-12";
export type ChimeStyle = "bell" | "sparkle" | "windchime";

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  color: string;
  age: number | null;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  kind: BookKind;
  shelf: string;
  coverUrl: string | null;
  sourceRef: string | null;
  notes: string | null;
  pageCount: number;
  storyCount: number;
  createdAt: number;
}

export interface BookPage {
  id: string;
  pageNumber: number;
  imageUrl: string;
}

export interface CastMember {
  /** "narrator" or a short slug like "ollie-owl" */
  id: string;
  name: string;
  /** Who this character is in the story. */
  description: string;
  /** What they should sound like, in plain words (used for casting & voice design). */
  voiceBrief: string;
  voiceId: string;
}

export interface ScriptLine {
  speaker: string;
  text: string;
}

export interface ScriptPage {
  /** 1-based page number; 0 is reserved for the read-along intro. */
  page: number;
  /** What the storyteller saw in the picture (helps grown-ups check the match). */
  picture: string;
  lines: ScriptLine[];
}

/** One short sound effect, landing on a word as it's spoken. */
export interface SoundCue {
  /** The page it belongs to (1-based). */
  page: number;
  /** Which line on that page (0-based). */
  line: number;
  /** The word in that line where the sound happens, e.g. "creaked". */
  word: string;
  /** What the sound is, for the sound generator: "a small wooden door creaks open". */
  sound: string;
  /** About how long it lasts. */
  seconds: number;
}

export interface StoryScript {
  title: string;
  synopsis: string;
  /** A short sound description for an optional looping background bed. */
  ambience: string;
  cast: CastMember[];
  pages: ScriptPage[];
  /** Sound effects chosen for this script, once they've been asked for. */
  effects?: SoundCue[];
}

export interface ChimeSettings {
  enabled: boolean;
  style: ChimeStyle;
  /** Quiet seconds after the chime so little hands can turn the page. */
  gapSeconds: number;
}

export type StorySource =
  | "book" // a new story for a physical book's pictures
  | "wild" // photos of something seen in the world
  | "idea" // description only
  | "classic" // read a public-domain book aloud
  | "book_read" // read your own book aloud from page photos
  | "text"; // read pasted text aloud

export interface StorySettings {
  source: StorySource;
  length: LengthPreset;
  mood: Mood;
  age: AgeBand;
  heroes: string[];
  lesson: string;
  extra: string;
  surprise: boolean;
  /** Keep character names printed in the book, so familiar friends get new adventures. */
  keepNames: boolean;
  description: string;
  /** null = let the casting director choose */
  narratorVoiceId: string | null;
  fullCast: boolean;
  chime: ChimeSettings;
  intro: boolean;
  /** A continuous soundscape under the whole story. */
  ambience: boolean;
  /** A few short sound effects at just the right moments. */
  effects: boolean;
  review: boolean;
  /** For read-aloud: a classic chapter reference. */
  classic?: { gutenbergId: number; chapter: number };
  /** For read-aloud of pasted text. */
  text?: string;
}

export interface StoryProgress {
  step: string;
  done: number;
  total: number;
}

export interface TimelineWord {
  /** start time (seconds, absolute in the story audio) */
  t: number;
  /** end time */
  e: number;
  w: string;
  speaker: string;
}

export interface TimelinePage {
  page: number;
  /** When this page's narration starts. */
  start: number;
  /** When the narration for this page finishes. */
  speechEnd: number;
  /** When the page-turn chime rings (null if no chime after this page). */
  chimeAt: number | null;
  /** When the next page begins. */
  next: number;
  words: TimelineWord[];
}

export interface StoryTimeline {
  duration: number;
  pages: TimelinePage[];
}

export interface Story {
  id: string;
  bookId: string;
  profileId: string | null;
  mode: StoryMode;
  title: string;
  synopsis: string | null;
  settings: StorySettings;
  script: StoryScript | null;
  status: StoryStatus;
  progress: StoryProgress | null;
  error: string | null;
  audioUrl: string | null;
  timeline: StoryTimeline | null;
  duration: number | null;
  favorite: boolean;
  playCount: number;
  lastPlayedAt: number | null;
  createdAt: number;
}

export interface StoryCard {
  id: string;
  bookId: string;
  bookTitle: string;
  bookKind: BookKind;
  coverUrl: string | null;
  profileId: string | null;
  mode: StoryMode;
  title: string;
  synopsis: string | null;
  status: StoryStatus;
  duration: number | null;
  favorite: boolean;
  playCount: number;
  lastPlayedAt: number | null;
  createdAt: number;
  /** The voice reading the narration, once the story has been written. */
  narratorVoiceId: string | null;
  /** How the family knows that voice, filled in where cards are shown. */
  narrator?: VoiceLabel | null;
}

/** A voice as the family knows it: "Professor Hoot" 🦉, "Gram T" 💛. */
export interface VoiceLabel {
  name: string;
  emoji: string;
}

export interface VoiceOption {
  voiceId: string;
  name: string;
  /** e.g. "warm, gravelly grandfather" */
  description: string;
  gender: string | null;
  age: string | null;
  accent: string | null;
  previewUrl: string | null;
  /** "persona" voices come with a friendly storybook name. */
  persona: { name: string; emoji: string; tagline: string } | null;
  source: "default" | "account" | "designed" | "family";
  /** Starred by the family, so it's easy to find again. */
  favorite?: boolean;
}

/** A family recording kept just as it was: a voicemail, a voice memo, a child reading. */
export interface Keepsake {
  id: string;
  person: string;
  title: string;
  recordedOn: string | null;
  audioUrl: string;
  durationMs: number;
  createdAt: number;
}

/** A storytelling voice learned from a grown-up's keepsake recordings. */
export interface FamilyVoice {
  voiceId: string;
  name: string;
  person: string;
  previewUrl: string | null;
  createdAt: number;
}

/** The family's ElevenLabs voice credit this month (one credit is about one letter read aloud). */
export interface VoiceCredits {
  left: number;
  used: number;
  limit: number;
  /** When the month's credit tops up again. */
  resetsAt: number | null;
  plan: string;
  /** Demo mode's pretend numbers. */
  demo?: boolean;
}

export interface AppStatus {
  demoMode: boolean;
  storyteller: boolean;
  voices: boolean;
  storyModel: string;
  voiceModel: string;
}
