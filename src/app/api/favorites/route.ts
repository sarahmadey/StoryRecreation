import { apiCtx, HttpError, readJson, route } from "@/lib/server/auth";
import { setFavoriteClassic, setFavoriteVoice } from "@/lib/server/db";

/** Star or unstar a storyteller or a book, for everyone in the family. */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  const body = await readJson<{
    voiceId?: string;
    book?: { gutenbergId?: number; title?: string; author?: string | null; cover?: string | null; emoji?: string | null };
    favorite?: boolean;
  }>(req);
  const favorite = body.favorite === true;
  if (typeof body.voiceId === "string" && body.voiceId) {
    setFavoriteVoice(ctx.household.id, body.voiceId.slice(0, 64), favorite);
    return Response.json({ ok: true });
  }
  const b = body.book;
  if (b && Number.isInteger(b.gutenbergId) && Number(b.gutenbergId) > 0 && typeof b.title === "string" && b.title.trim()) {
    const cover = typeof b.cover === "string" && /^https:\/\//.test(b.cover) ? b.cover.slice(0, 500) : null;
    setFavoriteClassic(
      ctx.household.id,
      {
        gutenbergId: Number(b.gutenbergId),
        title: b.title.trim().slice(0, 200),
        author: typeof b.author === "string" ? b.author.slice(0, 120) : null,
        cover,
        emoji: typeof b.emoji === "string" ? b.emoji.slice(0, 8) : null,
      },
      favorite,
    );
    return Response.json({ ok: true });
  }
  throw new HttpError(400, "Nothing to star.");
});
