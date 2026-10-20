import { connection } from "next/server";
import { isTestCopy } from "@/lib/server/config";

/** A teal frame and a label on every screen of the test copy, so it's never mistaken for the family's library. */
export async function TestCopyBanner() {
  await connection(); // which copy this is is known only at request time
  if (!isTestCopy()) return null;
  return (
    <>
      <div className="test-frame" aria-hidden="true" />
      <div className="test-chip" role="note">
        🧪 Test copy
      </div>
    </>
  );
}
