import { apiCtx, HttpError, route } from "@/lib/server/auth";
import { browseCatalogue, CLASSICS, ClassicsError, TOPICS, type TopicId } from "@/lib/server/classics";

/** The curated treasury, or a page of the whole library: ?q= searches titles and authors, ?topic= browses. */
export const GET = route(async (req: Request) => {
  await apiCtx();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const topic = url.searchParams.get("topic");
  const page = Number(url.searchParams.get("page")) || 1;
  if (!q && !topic) return Response.json({ classics: CLASSICS, topics: TOPICS });
  if (topic && !TOPICS.some((t) => t.id === topic)) throw new HttpError(400, "Unknown topic.");
  try {
    return Response.json(await browseCatalogue({ q, topic: (topic as TopicId) ?? undefined, page }));
  } catch (err) {
    console.error(err);
    throw new HttpError(502, err instanceof ClassicsError ? err.message : "The Gutenberg library couldn't be reached.");
  }
});
