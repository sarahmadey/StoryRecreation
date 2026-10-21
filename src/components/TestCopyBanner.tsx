import { connection } from "next/server";
import { isTestCopy } from "@/lib/server/config";
import { ScreenReadout } from "./ScreenReadout";

/** A teal frame and a label on every screen of the test copy, so it's never mistaken for the family's library. */
export async function TestCopyBanner() {
  await connection(); // which copy this is is known only at request time
  if (!isTestCopy()) return null;
  return (
    <>
      <div className="test-frame" aria-hidden="true" />
      {/* Railway says which update it's running, so it's easy to tell whether the latest one has arrived. */}
      <ScreenReadout version={process.env.RAILWAY_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null} />
    </>
  );
}
