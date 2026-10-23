import { apiCtx, HttpError, readJson, requireGrownup, route } from "@/lib/server/auth";
import { fileBooks, listBooks } from "@/lib/server/db";

/**
 * Make a folder of books, or change one: its name, and every book that's in it (`from` is its name before, for one
 * that's already there). The books it no longer lists go back on their shelves, so no books unpacks it.
 */
export const PUT = route(async (req: Request) => {
  const c = await apiCtx();
  requireGrownup(c);
  const body = await readJson<{ from?: unknown; name?: unknown; bookIds?: unknown }>(req);
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const bookIds = Array.isArray(body.bookIds) ? body.bookIds.filter((x): x is string => typeof x === "string").slice(0, 1000) : [];
  if (bookIds.length && !name) throw new HttpError(400, "Give the folder a name.");
  const folder = fileBooks(c.household.id, { from: typeof body.from === "string" ? body.from : null, name, bookIds });
  return Response.json({ folder, books: listBooks(c.household.id) });
});
