import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { createBook, listBooks, replacePages, updateBook } from "@/lib/server/db";
import { saveImage } from "@/lib/server/files";
import { MAX_PAGES, MissingPages, shelveUpload, type NewBook } from "@/lib/server/uploads";
import { BOOK_KINDS } from "@/lib/shared/options";
import type { BookKind } from "@/lib/shared/types";

export const GET = route(async () => {
  const ctx = await apiCtx();
  return Response.json({ books: listBooks(ctx.household.id) });
});

/** A new book's title, kind, author, shelf, folder and notes, checked. */
function details(get: (name: string) => unknown): NewBook {
  const text = (name: string, max: number) => String(get(name) ?? "").trim().slice(0, max);
  const title = text("title", 120);
  const kind = (text("kind", 40) || "picture_book") as BookKind;
  if (!title) throw new HttpError(400, "Every book needs a title.");
  if (!(kind in BOOK_KINDS) || kind === "classic") throw new HttpError(400, "Unknown kind of book.");
  return {
    title,
    kind,
    author: text("author", 120) || null,
    shelf: text("shelf", 60) || undefined,
    folder: text("folder", 40) || null,
    notes: text("notes", 1000) || null,
  };
}

/**
 * Create a book. As JSON once its page photos have come in one at a time (`upload` and how many `pages`: see
 * /api/uploads), or as a form with the page photos in it, in order.
 */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  if ((req.headers.get("content-type") ?? "").includes("application/json")) {
    const body = await readJson<Record<string, unknown>>(req);
    const book = details((name) => body[name]);
    if (!body.upload) return Response.json({ id: createBook(ctx.household.id, book) });
    try {
      return Response.json({ id: await shelveUpload(ctx.household.id, String(body.upload), Number(body.pages ?? 0), book) });
    } catch (err) {
      if (err instanceof MissingPages) return Response.json({ error: err.message, code: err.code, missing: err.pages }, { status: err.status });
      throw err;
    }
  }

  const form = await req.formData();
  const book = details((name) => form.get(name));
  const pages = form.getAll("pages").filter((f): f is File => f instanceof File && f.size > 0);
  if (pages.length > MAX_PAGES) throw new HttpError(400, `That's a lot of pages! ${MAX_PAGES} is the most for one book.`);

  const id = createBook(ctx.household.id, book);
  const saved: string[] = [];
  for (const file of pages) saved.push(await saveImage(ctx.household.id, `books/${id}`, file));
  replacePages(id, saved);

  const cover = form.get("cover");
  const coverPath =
    cover instanceof File && cover.size > 0 ? await saveImage(ctx.household.id, `books/${id}`, cover) : saved[0] ?? null;
  if (coverPath) updateBook(ctx.household.id, id, { coverPath });
  return Response.json({ id });
});
