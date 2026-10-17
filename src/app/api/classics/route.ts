import { apiCtx, HttpError, route } from "@/lib/server/auth";
import { CLASSICS, ClassicsError, resolveClassic, searchGutenberg } from "@/lib/server/classics";

/** The curated treasury, or a catalogue search with ?q= (or ?slug= to resolve one). */
export const GET = route(async (req: Request) => {
  await apiCtx();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const slug = url.searchParams.get("slug");
  try {
    if (slug) {
      const c = CLASSICS.find((x) => x.slug === slug);
      if (!c) throw new HttpError(404, "Unknown classic.");
      return Response.json({ gutenbergId: await resolveClassic(c) });
    }
    if (q) return Response.json({ results: await searchGutenberg(q) });
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(err);
    throw new HttpError(502, err instanceof ClassicsError ? err.message : "The Gutenberg library couldn't be reached.");
  }
  return Response.json({ classics: CLASSICS });
});
