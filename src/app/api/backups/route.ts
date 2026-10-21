import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { backupStatus, runBackup } from "@/lib/server/offsite";

/** How automatic backups are doing. */
export const GET = route(async () => {
  const c = await apiCtx();
  requireGrownup(c);
  return Response.json(backupStatus());
});

/** Back up now. It carries on in the background; check back with GET. */
export const POST = route(async () => {
  const c = await apiCtx();
  requireGrownup(c);
  if (!backupStatus().configured) throw new HttpError(400, "Automatic backups aren't set up yet.");
  void runBackup();
  return Response.json(backupStatus());
});
