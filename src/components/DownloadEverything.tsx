"use client";

import { useEffect, useRef, useState } from "react";
import { useApi } from "@/components/Grownup";
import { WaitLine } from "@/components/Waiting";

// "Download everything": the phone's own download does the work (it keeps going in the background, and the
// file lands where downloads do), so the page says what it can see: the backup is being got ready, then that
// the download has started. The library marks its answer with a cookie, so the page knows when it's begun.

/** Long enough for a big library to start coming down on a slow signal. */
const SLOW_MS = 25_000;
/** How long the grown-up PIN lasts on this device, a little under the library's own half hour. */
const UNLOCK_MS = 25 * 60 * 1000;

export function DownloadEverything({ bytes, unlockedUntil }: { bytes: number; unlockedUntil: number | null }) {
  const api = useApi();
  const [state, setState] = useState<{ step: "getting" | "started" | "slow"; startedAt: number } | null>(null);
  // Until when the PIN is good for: null when there's no PIN.
  const until = useRef(unlockedUntil);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (timer.current && clearInterval(timer.current)), []);

  const size = bytes < 1024 * 1024 ? "under 1 MB" : `about ${Math.round(bytes / (1024 * 1024))} MB`;
  const url = (token: string) => `/api/export?ready=${token}`;

  const watch = (token: string) => {
    if (timer.current) clearInterval(timer.current);
    const startedAt = Date.now();
    setState({ step: "getting", startedAt });
    timer.current = setInterval(() => {
      const mark = document.cookie.split("; ").find((c) => c.startsWith("storyhollow-download="))?.slice(21);
      if (mark === `${token}-locked`) {
        clearInterval(timer.current!);
        setState(null);
        unlockThenDownload();
      } else if (mark === token || Date.now() - startedAt > SLOW_MS) {
        clearInterval(timer.current!);
        setState({ step: mark === token ? "started" : "slow", startedAt });
      }
    }, 250);
  };

  /** The PIN first, then the download (started by the page, as the tap that asked for it has passed). */
  const unlockThenDownload = () =>
    void api.askPin().then((ok) => {
      if (!ok) return;
      until.current = Date.now() + UNLOCK_MS;
      const token = crypto.randomUUID();
      watch(token);
      window.location.assign(url(token));
    });

  const start = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (until.current !== null && Date.now() > until.current - 10_000) {
      // The PIN has run out since the page opened.
      e.preventDefault();
      unlockThenDownload();
      return;
    }
    const token = crypto.randomUUID();
    e.currentTarget.href = url(token);
    watch(token);
  };

  return (
    <>
      {state?.step === "getting" ? (
        <WaitLine what="Getting your backup ready" done={0} total={1} startedAt={state.startedAt} seconds={0} note={`It's ${size}.`} />
      ) : (
        <div>
          <a className="btn btn-sm" href="/api/export" download onClick={start}>
            ⬇ Download everything
          </a>
        </div>
      )}
      {state?.step === "started" ? (
        <p className="notice small" role="status" style={{ margin: 0 }}>
          ✓ Your backup is downloading ({size}). It carries on by itself, even if you leave this page. On an iPhone or iPad, it
          lands in the Files app, under Downloads.
        </p>
      ) : state?.step === "slow" ? (
        <p className="notice small" role="status" style={{ margin: 0 }}>
          It hasn&apos;t started yet. If nothing has downloaded in a minute, tap Download everything again.
        </p>
      ) : (
        state?.step !== "getting" && (
          <p className="hint" style={{ margin: 0 }}>
            On an iPhone or iPad, it lands in the Files app, under Downloads.
          </p>
        )
      )}
    </>
  );
}
