import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { createBook, listBooks, replacePages, updateBook } from "@/lib/server/db";
import { saveImage } from "@/lib/server/files";
import { BOOK_KINDS } from "@/lib/shared/options";
import type { BookKind } from "@/lib/shared/types";

export const GET = route(async () => {
  const ctx = await apiCtx();
  return Response.json({ books: listBooks(ctx.household.id) });
});

/** Create a book from a form: title, kind, shelf, and page photos in order. */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const form = await req.formData();
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const kind = String(form.get("kind") ?? "picture_book") as BookKind;
  if (!title) throw new HttpError(400, "Every book needs a title.");
  if (!(kind in BOOK_KINDS) || kind === "classic") throw new HttpError(400, "Unknown kind of book.");
  const pages = form.getAll("pages").filter((f): f is File => f instanceof File && f.size > 0);
  if (pages.length > 60) throw new HttpError(400, "That's a lot of pages! 60 is the most for one book.");

  const id = createBook(ctx.household.id, {
    title,
    kind,
    author: String(form.get("author") ?? "").trim().slice(0, 120) || null,
    shelf: String(form.get("shelf") ?? "").trim().slice(0, 60) || undefined,
    notes: String(form.get("notes") ?? "").trim().slice(0, 1000) || null,
  });
  const saved: string[] = [];
  for (const file of pages) saved.push(await saveImage(ctx.household.id, `books/${id}`, file));
  replacePages(id, saved);

  const cover = form.get("cover");
  const coverPath =
    cover instanceof File && cover.size > 0 ? await saveImage(ctx.household.id, `books/${id}`, cover) : saved[0] ?? null;
  if (coverPath) updateBook(ctx.household.id, id, { coverPath });
  return Response.json({ id });
});
