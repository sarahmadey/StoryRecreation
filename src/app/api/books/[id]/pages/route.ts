import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { getBook, replacePages, updateBook } from "@/lib/server/db";
import { saveImage } from "@/lib/server/files";

/** Replace a book's page photos (in the order sent). */
export const PUT = route(async (req: Request, ctx: RouteContext<"/api/books/[id]/pages">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { id } = await ctx.params;
  const book = getBook(c.household.id, id);
  if (!book) throw new HttpError(404, "That book isn't on the shelf.");
  const form = await req.formData();
  const pages = form.getAll("pages").filter((f): f is File => f instanceof File && f.size > 0);
  if (!pages.length || pages.length > 60) throw new HttpError(400, "Send between 1 and 60 page photos.");
  const saved: string[] = [];
  for (const file of pages) saved.push(await saveImage(c.household.id, `books/${id}`, file));
  replacePages(id, saved);
  if (!book.coverUrl) updateBook(c.household.id, id, { coverPath: saved[0] });
  return Response.json({ ok: true, pageCount: saved.length });
});
