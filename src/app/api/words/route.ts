import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { config } from "@/lib/server/config";
import { MAX_IMAGE_BYTES } from "@/lib/server/files";
import { recordAttempt, tooManyAttempts } from "@/lib/server/ratelimit";
import { readWordsFromPictures, StorytellerError, type StoryImage } from "@/lib/server/storyteller";
import { demoWordsFromPictures } from "@/lib/server/demo-storyteller";

const MAX_PICTURES = 6;

/** What kind of picture this is, from its first bytes (a phone's own format, like HEIC, isn't one the storyteller reads). */
function pictureType(bytes: Buffer): StoryImage["mediaType"] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.subarray(0, 4).toString("hex") === "89504e47") return "image/png";
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
  return null;
}

/** "Our own words" from a photo or screenshot: the words in the pictures, copied out for the family to check. */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const form = await req.formData();
  const pictures = form.getAll("pictures").filter((f): f is File => f instanceof File && f.size > 0);
  if (pictures.length === 0) throw new HttpError(400, "Choose a picture first.");
  if (pictures.length > MAX_PICTURES) throw new HttpError(400, `Up to ${MAX_PICTURES} pictures at a time, please.`);
  const images: StoryImage[] = [];
  for (const file of pictures) {
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "That picture is too big (8 MB max).");
    const bytes = Buffer.from(await file.arrayBuffer());
    const mediaType = pictureType(bytes);
    if (!mediaType) throw new HttpError(400, "That picture couldn't be opened. A screenshot of it usually works.");
    images.push({ data: bytes.toString("base64"), mediaType });
  }

  if (!config.anthropicKey) {
    if (config.demoMode) return Response.json(demoWordsFromPictures(images.length));
    throw new HttpError(503, "Reading words from a picture needs the storyteller (an Anthropic key). You can still type or paste them.", "no_storyteller");
  }
  const key = `words:${ctx.household.id}`;
  if (tooManyAttempts(key, 30, 60 * 60 * 1000)) throw new HttpError(429, "That's a lot of pictures this hour. Try again a little later.");
  recordAttempt(key);
  try {
    return Response.json(await readWordsFromPictures(images));
  } catch (err) {
    if (err instanceof StorytellerError) throw new HttpError(502, err.message);
    throw err;
  }
});
