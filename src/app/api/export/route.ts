import { apiCtx, requireGrownup, route } from "@/lib/server/auth";
import { familyBackup } from "@/lib/server/backup";
import { zipStream } from "@/lib/server/zip";

// "Download everything": the family's whole library in one ZIP.
export const GET = route(async () => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const { filename, entries } = familyBackup(ctx.household.id);
  const { stream, size } = zipStream(entries);
  const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return new Response(stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
});
