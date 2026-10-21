import { db } from "@/lib/server/db";

/**
 * For an uptime monitor (like UptimeRobot) to check every few minutes: 200 when the app is up and
 * its library can be read, 503 when not. Says nothing else, so it's safe to leave public.
 */
export function GET() {
  try {
    db().prepare("SELECT 1").get();
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
