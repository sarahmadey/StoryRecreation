import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { changeStoryArt, getStory } from "@/lib/server/db";
import { MAX_IMAGE_BYTES } from "@/lib/server/files";
import { recordAttempt, tooManyAttempts } from "@/lib/server/ratelimit";
import { describeFromPhoto, StorytellerError, type StoryImage } from "@/lib/server/storyteller";
import { demoLookFromPhoto } from "@/lib/server/demo-storyteller";
import { recordSpend } from "@/lib/server/spending";

/** What kind of picture this is, from its first bytes. */
function photoType(bytes: Buffer): StoryImage["mediaType"] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

/**
 * A character's look, written by the storyteller from a photo of the person they're based on. The photo is looked
 * at once and never kept: it isn't saved, and the illustrator only ever sees the words.
 */
export const POST = route(async (req: Request, ctx: RouteContext<"/api/stories/[id]/art/describe">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const story = getStory(c.household.id, id);
  if (!story?.art) throw new HttpError(404, "This story isn't a picture book yet.");
  const form = await req.formData();
  const character = story.art.characters.find((ch) => ch.id === form.get("characterId"));
  if (!character) throw new HttpError(404, "That character wasn't found.");
  const photo = form.get("photo");
  if (!(photo instanceof File) || photo.size === 0) throw new HttpError(400, "Choose a photo first.");
  if (photo.size > MAX_IMAGE_BYTES) throw new HttpError(400, "That photo is too big (8 MB max).");
  const bytes = Buffer.from(await photo.arrayBuffer());
  const mediaType = photoType(bytes);
  if (!mediaType) throw new HttpError(400, "That photo couldn't be opened. A screenshot of it usually works.");
  const words = typeof form.get("words") === "string" ? String(form.get("words")).slice(0, 500) : character.look;

  let look: string;
  if (config.anthropicKey) {
    const key = `describe:${c.household.id}`;
    if (tooManyAttempts(key, 30, 60 * 60 * 1000)) throw new HttpError(429, "That's a lot of photos this hour. Try again a little later.");
    recordAttempt(key);
    try {
      const out = await describeFromPhoto({ data: bytes.toString("base64"), mediaType }, { name: character.name, words });
      look = out.look;
      recordSpend(c.household.id, { storyId: id, service: "storyteller", kind: "describe", what: `Described ${character.name} from a photo`, spent: out.cost });
    } catch (err) {
      if (err instanceof StorytellerError) throw new HttpError(502, err.message);
      throw err;
    }
  } else if (config.demoMode) {
    look = demoLookFromPhoto(words);
  } else {
    throw new HttpError(503, "Describing from a photo needs the storyteller (an Anthropic key). You can still describe them in words.", "no_storyteller");
  }
  changeStoryArt(id, (a) => a && { ...a, characters: a.characters.map((ch) => (ch.id === character.id ? { ...ch, look } : ch)) });
  return Response.json({ story: getStory(c.household.id, id) });
});
