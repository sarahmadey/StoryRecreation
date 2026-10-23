import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { MAX_IMAGE_BYTES } from "@/lib/server/files";
import { receivePhoto } from "@/lib/server/uploads";

/** Page `n` of a new book, on its way in: the photo itself is the body. Sent again, it replaces the one before. */
export const PUT = route(async (req: Request, ctx: RouteContext<"/api/uploads/[key]/[n]">) => {
  const c = await apiCtx();
  requireGrownup(c);
  const { key, n } = await ctx.params;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) throw new HttpError(413, "That photo is too big (8 MB max).");
  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  await receivePhoto(c.household.id, key, Number(n), type, Buffer.from(await req.arrayBuffer()));
  return Response.json({ ok: true });
});
