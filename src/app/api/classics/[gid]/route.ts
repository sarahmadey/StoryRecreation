import { apiCtx, HttpError, route } from "@/lib/server/auth";
import { ClassicsError, loadClassic } from "@/lib/server/classics";

/** A classic's chapters, with a peek at how each one begins. */
export const GET = route(async (_req: Request, ctx: RouteContext<"/api/classics/[gid]">) => {
  await apiCtx();
  const { gid } = await ctx.params;
  const id = Number(gid);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, "That isn't a Gutenberg book number.");
  try {
    const book = await loadClassic(id);
    return Response.json({
      gutenbergId: id,
      title: book.title,
      author: book.author,
      chapters: book.chapters.map((c, i) => ({
        index: i,
        title: c.title,
        words: c.words,
        characters: c.text.length,
        opening: c.text.slice(0, 220).replace(/\s+/g, " "),
      })),
    });
  } catch (err) {
    console.error(err);
    throw new HttpError(502, err instanceof ClassicsError ? err.message : "The Gutenberg library couldn't be reached.");
  }
});
