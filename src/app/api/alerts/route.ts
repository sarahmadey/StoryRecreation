import { apiCtx, HttpError, requireGrownup, route } from "@/lib/server/auth";
import { alertsStatus, sendTestAlert } from "@/lib/server/alerts";

/** Whether problem alerts are on, where they go, and the last few sent. */
export const GET = route(async () => {
  const c = await apiCtx();
  requireGrownup(c);
  return Response.json(alertsStatus());
});

/** Send a test email. */
export const POST = route(async () => {
  const c = await apiCtx();
  requireGrownup(c);
  if (!alertsStatus().configured) throw new HttpError(400, "Problem alerts aren't set up yet.");
  const sent = await sendTestAlert();
  const status = alertsStatus();
  if (!sent) {
    const failed = status.recent.find((a) => a.kind === "test" && !a.ok);
    throw new HttpError(502, failed?.error ? `The test email didn't go: ${failed.error}` : "A test email went out less than a minute ago.");
  }
  return Response.json(status);
});
