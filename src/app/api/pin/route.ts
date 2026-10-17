import {
  apiCtx,
  grownupUnlockUntil,
  hashSecret,
  HttpError,
  readJson,
  requireGrownup,
  route,
  verifySecret,
} from "@/lib/server/auth";
import { setHouseholdPin, setSessionGrownup } from "@/lib/server/db";
import { clearAttempts, recordAttempt, tooManyAttempts } from "@/lib/server/ratelimit";

/** Enter the grown-up PIN to unlock creating and settings for a while. */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  const { pin } = await readJson<{ pin?: string }>(req);
  if (!ctx.household.pin_hash) return Response.json({ ok: true });
  const key = `pin:${ctx.household.id}`;
  if (tooManyAttempts(key, 8)) throw new HttpError(429, "Too many tries. Ask a grown-up to try again later.");
  if (!pin || !verifySecret(pin, ctx.household.pin_hash)) {
    recordAttempt(key);
    throw new HttpError(401, "That's not the right PIN.");
  }
  clearAttempts(key);
  setSessionGrownup(ctx.session.id, grownupUnlockUntil());
  return Response.json({ ok: true });
});

/** Set or clear the PIN. */
export const PUT = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const { pin } = await readJson<{ pin?: string | null }>(req);
  if (pin === null || pin === "") {
    setHouseholdPin(ctx.household.id, null);
    return Response.json({ ok: true, pinSet: false });
  }
  if (!pin || !/^\d{4,8}$/.test(pin)) throw new HttpError(400, "A PIN is 4 to 8 digits.");
  setHouseholdPin(ctx.household.id, hashSecret(pin));
  setSessionGrownup(ctx.session.id, grownupUnlockUntil());
  return Response.json({ ok: true, pinSet: true });
});

/** Lock again (e.g. before handing the tablet to a child). */
export const DELETE = route(async () => {
  const ctx = await apiCtx();
  setSessionGrownup(ctx.session.id, 0);
  return Response.json({ ok: true });
});
