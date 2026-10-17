import { HttpError, readJson, route, startSession, verifySecret } from "@/lib/server/auth";
import { findHouseholdByEmail } from "@/lib/server/db";
import { clearAttempts, recordAttempt, tooManyAttempts } from "@/lib/server/ratelimit";

export const POST = route(async (req: Request) => {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = body.email?.trim().toLowerCase() ?? "";
  const key = `login:${email}`;
  if (tooManyAttempts(key)) throw new HttpError(429, "Too many tries. Please wait a few minutes and try again.");
  const household = email ? findHouseholdByEmail(email) : undefined;
  if (!household || !verifySecret(body.password ?? "", household.password_hash)) {
    recordAttempt(key);
    throw new HttpError(401, "That email and password don't match.");
  }
  clearAttempts(key);
  await startSession(household.id);
  return Response.json({ ok: true });
});
