import { apiCtx, route } from "@/lib/server/auth";
import { familyBackup } from "@/lib/server/backup";
import { config } from "@/lib/server/config";
import { zipStream } from "@/lib/server/zip";

// "Download everything": the family's whole library in one ZIP. When the page asks (`ready`), the answer
// carries a cookie with its mark, so the page can tell the family the download has started, or that the
// grown-up PIN is needed first (the page can't see a download's answer any other way).
export const GET = route(async (req: Request) => {
  const ctx = await apiCtx();
  const ready = new URL(req.url).searchParams.get("ready");
  const mark = ready && /^[A-Za-z0-9-]{8,64}$/.test(ready) ? ready : null;
  const cookie = (value: string) => `storyhollow-download=${value}; Path=/; Max-Age=300; SameSite=Lax${config.secureCookies ? "; Secure" : ""}`;
  if (!ctx.grownup) {
    // To the page: a mark that asks for the PIN, and no body (an error message would be saved as a file).
    if (mark) return new Response(null, { status: 204, headers: { "Set-Cookie": cookie(`${mark}-locked`) } });
    return Response.json({ error: "A grown-up needs to enter the PIN.", code: "pin_required" }, { status: 403 });
  }
  const { filename, entries } = familyBackup(ctx.household.id);
  const { stream, size } = zipStream(entries);
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/zip",
    "Content-Length": String(size),
    "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "no-store",
  };
  if (mark) headers["Set-Cookie"] = cookie(mark);
  return new Response(stream, { headers });
});
