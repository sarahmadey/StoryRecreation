import { endSession, route } from "@/lib/server/auth";

export const POST = route(async () => {
  await endSession();
  return Response.json({ ok: true });
});
