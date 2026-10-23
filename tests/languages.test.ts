// Stories in French and Spanish: what the family chose is kept, words read aloud are recognised, and a voice can be
// designed speaking the language.

import { test } from "node:test";
import assert from "node:assert/strict";
import { guessLanguage, speaksLanguage, VOICE_SAMPLES, SAYINGS } from "@/lib/shared/languages";
import { sanitizeSettings } from "@/lib/server/settings";

test("the language some words are in: French and Spanish when it's plain, English otherwise", () => {
  assert.equal(guessLanguage("Il était une fois une petite chouette qui rêvait de voir la mer. Elle regardait les étoiles."), "fr");
  assert.equal(guessLanguage("Había una vez una pequeña lechuza que soñaba con ver el mar. Cada noche miraba las estrellas."), "es");
  assert.equal(guessLanguage("Once upon a time there was a little owl who dreamed of the sea. She watched the stars."), "en");
  assert.equal(guessLanguage("Dear Grandma, thank you for the scarf! It is so warm and I wear it every day."), "en");
  assert.equal(guessLanguage("Bonjour"), "en", "too little to tell is English");
  assert.equal(guessLanguage(""), "en");
});

test("a story's language is kept only when it's one we tell stories in, with whether it's for a learner", () => {
  assert.deepEqual(
    [sanitizeSettings({ language: "fr", learner: true }), sanitizeSettings({ language: "es" }), sanitizeSettings({ language: "de", learner: true }), sanitizeSettings({})].map(
      (s) => [s.language, s.learner],
    ),
    [
      ["fr", true],
      ["es", false],
      [undefined, undefined],
      [undefined, undefined],
    ],
  );
});

test("a voice designed for French or Spanish stories is made speaking the language, and says so", () => {
  assert.equal(speaksLanguage("A warm grandmother.", "en"), "A warm grandmother.");
  assert.equal(speaksLanguage("A warm grandmother.", "fr"), "Speaks French natively, with a natural French accent. A warm grandmother.");
  for (const sample of Object.values(VOICE_SAMPLES)) assert.ok(sample.length >= 100 && sample.length <= 1000, "ElevenLabs takes 100 to 1000 letters");
  assert.equal(SAYINGS.es.welcome("El Gato", SAYINGS.es.readBy("Professor Hoot")), "Bienvenidos a Storyhollow. El cuento de esta noche se llama El Gato, leído para ti por Professor Hoot.");
});
