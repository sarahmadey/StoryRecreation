import { hashSecret, HttpError, readJson, route, startSession } from "@/lib/server/auth";
import { createHousehold, findHouseholdByEmail } from "@/lib/server/db";
import { recordAttempt, tooManyAttempts } from "@/lib/server/ratelimit";
import { codeMatches, signupMode } from "@/lib/server/signup";

export const POST = route(async (req: Request) => {
  const body = await readJson<{ familyName?: string; email?: string; password?: string; signupCode?: string }>(req);
  const mode = signupMode();
  if (mode === "closed") {
    throw new HttpError(403, "New library cards are closed here. Ask the family who runs this library for its sign-up code.");
  }
  if (mode === "code") {
    if (tooManyAttempts("signup", 20)) throw new HttpError(429, "Too many tries. Please wait a few minutes.");
    if (!codeMatches(body.signupCode ?? "")) {
      recordAttempt("signup");
      throw new HttpError(403, "That sign-up code isn't right.");
    }
  }
  const familyName = body.familyName?.trim().slice(0, 60);
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  if (!familyName) throw new HttpError(400, "What should we call your family?");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Please enter a valid email.");
  if (password.length < 8) throw new HttpError(400, "Passwords need at least 8 characters.");
  if (findHouseholdByEmail(email)) throw new HttpError(409, "That email already has a library. Try signing in.");
  const id = createHousehold(familyName, email, hashSecret(password));
  await startSession(id);
  return Response.json({ ok: true });
});
