import { apiCtx, HttpError, route } from "@/lib/server/auth";
import { CLASSICS, ClassicsError, searchGutenberg } from "@/lib/server/classics";

/** The curated treasury, or a catalogue search with ?q=. */
export const GET = route(async (req: Request) => {
  await apiCtx();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  try {
    if (q) return Response.json({ results: await searchGutenberg(q) });
  } catch (err) {
    console.error(err);
    throw new HttpError(502, err instanceof ClassicsError ? err.message : "The Gutenberg library couldn't be reached.");
  }
  return Response.json({ classics: CLASSICS });
});
