import { wordsPerPage } from "@/lib/shared/options";
import { normalizeScript, type RawScript, type StoryRequest, type WriteProgress, type WrittenStory } from "./storyteller";
import { sectionText } from "./text";

// A pretend storyteller for DEMO_MODE, so every screen can be explored
// without API keys. It is deliberately simple and says so in the story.

const FILLER = [
  "The lantern glowed softly, and the shadows on the wall began to stretch and wiggle.",
  "Somewhere far away, a sleepy owl said hoo, and the whole forest seemed to listen.",
  "A tiny breeze tiptoed past, carrying the smell of warm toast and pine needles.",
  "Everyone held their breath. Something wonderful was about to happen.",
  "The stars leaned closer, the way stars do when a good story is being told.",
];

export async function writeDemoScript(req: StoryRequest, onProgress: WriteProgress): Promise<WrittenStory> {
  const narrator = req.settings.narratorVoiceId ?? req.voices[0]?.voiceId ?? "demo-narrator";
  const others = req.voices.filter((v) => v.voiceId !== narrator);
  const heroName = req.settings.heroes[0] ?? "Juniper";

  if (req.mode === "read" && req.text) {
    const sections = sectionText(req.text, 900);
    onProgress("Reading the pages", sections.length, sections.length);
    const script = normalizeScript(
      {
        title: req.bookTitle,
        synopsis: `A faithful reading of ${req.bookTitle}.`,
        ambience: "a crackling fireplace in a quiet room",
        cast: [{ id: "narrator", name: "Narrator", description: "The reader", voice_brief: "warm", voice_id: narrator }],
        pages: sections.map((t, i) => ({ page: i + 1, photo: 0, picture: "", lines: [{ speaker: "narrator", text: t }] })),
      },
      req,
    );
    return { script, photoOrder: null };
  }

  const raw: RawScript = {
    title:
      req.mode === "create"
        ? `${heroName} and the Lantern of ${req.bookTitle.split(/\s+/).sort((a, b) => b.length - a.length)[0] || "Dreams"}`
        : req.bookTitle,
    synopsis:
      req.mode === "create"
        ? `A demo story: ${heroName} follows a glowing lantern through ${req.pageCount} pages of shadows and wonder.`
        : `A demo reading of ${req.bookTitle}.`,
    ambience: "soft night crickets and a faint breeze in the trees",
    cast: [
      { id: "narrator", name: "Narrator", description: "The storyteller", voice_brief: "warm, gentle", voice_id: narrator },
      {
        id: "hero",
        name: heroName,
        description: "a curious, brave child",
        voice_brief: "bright, eager young voice",
        voice_id: others[0]?.voiceId ?? narrator,
      },
      {
        id: "ollie-owl",
        name: "Ollie the Owl",
        description: "a wise and slightly sleepy owl",
        voice_brief: "old, warm, a little creaky",
        voice_id: others[1]?.voiceId ?? narrator,
      },
    ],
    pages: [],
  };

  const target = wordsPerPage(req.settings.length, req.pageCount);
  for (let i = 0; i < req.pageCount; i++) {
    await new Promise((r) => setTimeout(r, 120));
    const lines: RawScript["pages"][number]["lines"] = [];
    if (req.mode === "read") {
      lines.push({ speaker: "narrator", text: `This is where the words printed on page ${i + 1} would be read aloud, exactly as written.` });
    } else {
      lines.push({
        speaker: "narrator",
        text: `This is a demo page, number ${i + 1}. With an Anthropic key, the storyteller writes a real story that matches this picture.`,
      });
      let words = lines[0].text.split(" ").length;
      let f = i;
      while (words < target - 12) {
        const t = FILLER[f++ % FILLER.length];
        lines.push({ speaker: "narrator", text: t });
        words += t.split(" ").length;
      }
      if (i % 2 === 0) lines.push({ speaker: "hero", text: "[excitedly] Did you see that? Let's turn the page!" });
      else lines.push({ speaker: "ollie-owl", text: "[sleepily] Hoo... Patience, little one. The best part is coming." });
    }
    raw.pages.push({ page: i + 1, photo: i + 1, picture: `Picture ${i + 1}`, lines });
    onProgress(req.mode === "create" ? "Writing the pages" : "Reading the pages", i + 1, req.pageCount);
  }
  return { script: normalizeScript(raw, req), photoOrder: null };
}
