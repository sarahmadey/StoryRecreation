import type { StoryLanguage } from "./types";

// The app itself speaks English; a story can be told (and a book read) in any of these.

export const LANGUAGES: Record<StoryLanguage, { name: string; native: string; in: string }> = {
  en: { name: "English", native: "English", in: "in English" },
  fr: { name: "French", native: "Français", in: "en français" },
  es: { name: "Spanish", native: "Español", in: "en español" },
};

/** A story's language: English unless it's one of the others. */
export const languageOf = (code: unknown): StoryLanguage => (code === "fr" || code === "es" ? code : "en");

/** What the storyteller says around the story itself, in each language. */
export const SAYINGS: Record<
  StoryLanguage,
  {
    welcome: (title: string, readBy: string) => string;
    readBy: (name: string) => string;
    /** For a book in the child's lap: how they'll know to turn the page. */
    followAlong: string;
    snuggleIn: string;
    firstPage: string;
    theEnd: string;
    chapterEnd: string;
    /** The last line already says the story (or chapter) is over. */
    saysTheEnd: RegExp;
  }
> = {
  en: {
    welcome: (title, readBy) => `Welcome to Storyhollow. Tonight's story is called ${title}${readBy}.`,
    readBy: (name) => `, read for you by ${name}`,
    followAlong: "You can follow along with the pictures in your book. You'll know it's time to turn the page when you hear this sound...",
    snuggleIn: "So snuggle in... and let's begin.",
    firstPage: "That's the one! Now, open your book to the very first page... and let's begin.",
    theEnd: "The end.",
    chapterEnd: "That's the end of this chapter.",
    saysTheEnd: /\bthe end\b[\s.!…"”']*$|\bend of (this|the) chapter\b/i,
  },
  fr: {
    welcome: (title, readBy) => `Bienvenue à Storyhollow. L'histoire de ce soir s'appelle ${title}${readBy}.`,
    readBy: (name) => `, lue pour toi par ${name}`,
    followAlong: "Tu peux suivre avec les images de ton livre. Quand tu entendras ce son, ce sera le moment de tourner la page...",
    snuggleIn: "Alors, installe-toi bien... et commençons.",
    firstPage: "C'est celui-là ! Maintenant, ouvre ton livre à la toute première page... et commençons.",
    theEnd: "Fin.",
    chapterEnd: "C'est la fin de ce chapitre.",
    saysTheEnd: /\bfin\b[\s.!…"”'»]*$|\bfin de ce chapitre\b/i,
  },
  es: {
    welcome: (title, readBy) => `Bienvenidos a Storyhollow. El cuento de esta noche se llama ${title}${readBy}.`,
    readBy: (name) => `, leído para ti por ${name}`,
    followAlong: "Puedes seguir las imágenes de tu libro. Cuando oigas este sonido, será el momento de pasar la página...",
    snuggleIn: "Así que acurrúcate... y empecemos.",
    firstPage: "¡Ese es! Ahora, abre tu libro en la primera página... y empecemos.",
    theEnd: "Fin.",
    chapterEnd: "Aquí termina este capítulo.",
    saysTheEnd: /\bfin\b[\s.!…"”'»]*$|\btermina este cap[ií]tulo\b/i,
  },
};

/** A designed voice's description, saying first what language it speaks: so it's made speaking it, and cast for stories in it. */
export function speaksLanguage(description: string, language: StoryLanguage): string {
  const name = LANGUAGES[language].name;
  return language === "en" ? description : `Speaks ${name} natively, with a natural ${name} accent. ${description}`;
}

/** A little of a story in each language, for a voice to be designed speaking it. */
export const VOICE_SAMPLES: Record<Exclude<StoryLanguage, "en">, string> = {
  fr: "Il était une fois, au fond d'une forêt tranquille, une petite chouette qui rêvait de voir la mer. Chaque soir, elle regardait les étoiles et murmurait : un jour, j'irai là-bas.",
  es: "Había una vez, en lo más profundo de un bosque tranquilo, una pequeña lechuza que soñaba con ver el mar. Cada noche miraba las estrellas y susurraba: algún día iré allí.",
};

// Little words that come up in almost every sentence, a few of them only in one language, and letters only one uses.
const COMMON: Record<StoryLanguage, Set<string>> = {
  en: new Set("the and is was of to you he she it with my his her they said what there".split(" ")),
  fr: new Set("le les et est une des du je tu il elle nous vous dans pour avec pas qui sur c'est était au aux mais très".split(" ")),
  es: new Set("el los las y es una del yo tú él ella con para por pero muy está era dijo al como".split(" ")),
};
const LETTERS: Record<StoryLanguage, RegExp> = { en: /(?!)/g, fr: /[àâçèêëîïôœùûÿ]/g, es: /[ñ¿¡áíóú]/g };

/** The language some words are in, as far as one can tell: English unless they're plainly French or Spanish. */
export function guessLanguage(text: string): StoryLanguage {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  const score = (lang: StoryLanguage) =>
    words.filter((w) => COMMON[lang].has(w)).length + 2 * (text.toLowerCase().match(LETTERS[lang])?.length ?? 0);
  const [best, bestScore] = (["fr", "es"] as const).map((l) => [l, score(l)] as const).sort((a, b) => b[1] - a[1])[0];
  return bestScore >= 3 && bestScore > 1.5 * score("en") ? best : "en";
}
