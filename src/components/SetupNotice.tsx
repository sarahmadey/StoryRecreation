import Link from "next/link";
import type { AppStatus } from "@/lib/shared/types";

/** A gentle nudge when the storyteller or voices aren't connected yet. */
export function SetupNotice({ status }: { status: AppStatus }) {
  if (status.storyteller && status.voices) return null;
  if (status.demoMode) {
    return (
      <p className="notice small center">
        🎭 <b>Demo mode.</b> Stories are pretend and the voices are humming placeholders. Add API keys to bring the
        real storytellers in. <Link href="/grownups">How?</Link>
      </p>
    );
  }
  const missing = [!status.storyteller && "the storyteller (Anthropic)", !status.voices && "the voices (ElevenLabs)"].filter(Boolean);
  return (
    <p className="notice small center">
      🗝️ The library still needs keys for {missing.join(" and ")}. <Link href="/grownups">Grown-ups, here's how.</Link>
    </p>
  );
}
