import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { deleteBook, getBook, listPages, listStoryCards, updateBook } from "@/lib/server/db";
import { removeDir, resolveHouseholdPath } from "@/lib/server/files";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/books/[id]">) => {
  const c = await apiCtx();
  const { id } = await ctx.params;
  const book = getBook(c.household.id, id);
  if (!book) throw new HttpError(404, "That book isn't on the shelf.");
  return Response.json({ book, pages: listPages(id), stories: listStoryCards(c.household.id, { bookId: id }) });
});

export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/books/[id]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  if (!getBook(c.household.id, id)) throw new HttpError(404, "That book isn't on the shelf.");
  const body = await readJson<{ title?: string; author?: string | null; shelf?: string; notes?: string | null }>(req);
  updateBook(c.household.id, id, {
    ...(body.title?.trim() ? { title: body.title.trim().slice(0, 120) } : {}),
    ...(body.author !== undefined ? { author: body.author?.trim().slice(0, 120) || null } : {}),
    ...(body.shelf?.trim() ? { shelf: body.shelf.trim().slice(0, 60) } : {}),
    ...(body.notes !== undefined ? { notes: body.notes?.trim().slice(0, 1000) || null } : {}),
  });
  return Response.json({ book: getBook(c.household.id, id) });
});

export const DELETE = route(async (_req: Request, ctx: RouteContext<"/api/books/[id]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const stories = listStoryCards(c.household.id, { bookId: id });
  deleteBook(c.household.id, id);
  await removeDir(resolveHouseholdPath(c.household.id, `books/${id}`));
  for (const s of stories) await removeDir(resolveHouseholdPath(c.household.id, `stories/${s.id}`));
  return Response.json({ ok: true });
});
