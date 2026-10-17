import fs from "node:fs";
import { Readable } from "node:stream";
import { apiCtx, HttpError, route } from "@/lib/server/auth";
import { mediaTypeFor, resolveHouseholdPath } from "@/lib/server/files";

// Serves a family's own photos and story audio. Audio honours Range
// requests, which iOS Safari needs before it will play or seek.
export const GET = route(async (req: Request, ctx: RouteContext<"/api/files/[...path]">) => {
  const c = await apiCtx();
  const { path: parts } = await ctx.params;
  const full = resolveHouseholdPath(c.household.id, parts.join("/"));
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(full);
  } catch {
    throw new HttpError(404, "Not found.");
  }
  if (!stat.isFile()) throw new HttpError(404, "Not found.");

  const type = mediaTypeFor(full);
  const download = new URL(req.url).searchParams.get("download");
  const headers: Record<string, string> = {
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=31536000, immutable",
    ...(download ? { "Content-Disposition": `attachment; filename="${download.replace(/[^\w .-]/g, "")}"` } : {}),
  };

  const range = req.headers.get("range");
  const match = range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match && (match[1] || match[2])) {
    let start = match[1] ? Number(match[1]) : stat.size - Number(match[2]);
    let end = match[1] && match[2] ? Number(match[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(stat.size - 1, end);
    if (start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${stat.size}` } });
    }
    const stream = Readable.toWeb(fs.createReadStream(full, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) },
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(full)) as ReadableStream;
  return new Response(stream, { headers: { ...headers, "Content-Length": String(stat.size) } });
});
