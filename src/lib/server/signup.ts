import { timingSafeEqual } from "node:crypto";
import { config } from "./config";
import { countHouseholds } from "./db";

export type SignupMode = "open" | "code" | "closed";

/**
 * Who may open a new library. With SIGNUP_CODE set, everyone needs the code
 * (even the first family). Without it, only the very first family can sign
 * up, so a public URL can't be used by strangers to spend the family's credits.
 */
export function signupMode(): SignupMode {
  if (config.signupCode) return "code";
  return countHouseholds() === 0 ? "open" : "closed";
}

export function codeMatches(given: string): boolean {
  const want = Buffer.from(config.signupCode ?? "");
  const got = Buffer.from(given.trim());
  return want.length > 0 && want.length === got.length && timingSafeEqual(want, got);
}
