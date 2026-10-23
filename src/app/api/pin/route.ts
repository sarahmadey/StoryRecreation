import { apiCtx, hashSecret, HttpError, readJson, requireGrownup, route, unlockDevice, verifySecret } from "@/lib/server/auth";
import { rememberPinDigits, setHouseholdPin, setSessionGrownup } from "@/lib/server/db";
import { clearAttempts, recordAttempt, tooManyAttempts } from "@/lib/server/ratelimit";

/**
 * Whether the family has a PIN (buying pictures needs one), how many digits it has (so the pad checks it the
 * moment it's all in, like a phone's passcode), and whether this device is unlocked, and until when.
 */
export const GET = route(async () => {
  const ctx = await apiCtx();
  const pinSet = Boolean(ctx.household.pin_hash);
  return Response.json({
    pinSet,
    digits: pinSet ? ctx.household.pin_digits : null,
    unlocked: ctx.grownup,
    until: pinSet && ctx.grownup ? ctx.session.grownup_until : null,
  });
});

/** Enter the grown-up PIN to unlock this device for a while: half an hour, or 30 days if it's to be remembered. */
export const POST = route(async (req: Request) => {
  const ctx = await apiCtx();
  const { pin, remember } = await readJson<{ pin?: string; remember?: boolean }>(req);
  if (!ctx.household.pin_hash) return Response.json({ ok: true });
  const key = `pin:${ctx.household.id}`;
  if (tooManyAttempts(key, 8)) throw new HttpError(429, "Too many tries. Ask a grown-up to try again later.");
  if (!pin || !verifySecret(pin, ctx.household.pin_hash)) {
    recordAttempt(key);
    throw new HttpError(401, "That's not the right PIN.");
  }
  clearAttempts(key);
  if (ctx.household.pin_digits === null) rememberPinDigits(ctx.household.id, pin.length);
  unlockDevice(ctx, remember === true);
  return Response.json({ ok: true });
});

/** Set or clear the PIN. */
export const PUT = route(async (req: Request) => {
  const ctx = await apiCtx();
  requireGrownup(ctx);
  const { pin, remember } = await readJson<{ pin?: string | null; remember?: boolean }>(req);
  if (pin === null || pin === "") {
    setHouseholdPin(ctx.household.id, null);
    return Response.json({ ok: true, pinSet: false });
  }
  if (!pin || !/^\d{4,8}$/.test(pin)) throw new HttpError(400, "A PIN is 4 to 8 digits.");
  setHouseholdPin(ctx.household.id, hashSecret(pin), pin.length);
  unlockDevice(ctx, remember === true);
  return Response.json({ ok: true, pinSet: true });
});

/** Lock again, and stop remembering this device (before handing the tablet to a child, say). */
export const DELETE = route(async () => {
  const ctx = await apiCtx();
  setSessionGrownup(ctx.session.id, 0);
  return Response.json({ ok: true });
});
