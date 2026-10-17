import { hashSecret, HttpError, readJson, route, startSession } from "@/lib/server/auth";
import { createHousehold, findHouseholdByEmail } from "@/lib/server/db";

export const POST = route(async (req: Request) => {
  const body = await readJson<{ familyName?: string; email?: string; password?: string }>(req);
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
