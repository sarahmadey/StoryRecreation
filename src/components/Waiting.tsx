"use client";

import { useEffect, useState } from "react";
import { timeLeft } from "@/lib/shared/art";

// Waiting, made visible: whenever the app is working on something, it says what,
// how far along it is, and about how long is left, so nobody wonders whether a
// tap did anything.

/** The time, ticking once a second while `active`. It starts at `from`, so the page draws the same on the server and in the browser. */
export function useNow(active: boolean, from: number): number {
  const [now, setNow] = useState(from);
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/** Something is at work. */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

/** "Sketching Mia · 1 of 3 ready · about 30 seconds left" (the time, when it's known), and a word on whether it's fine to leave. */
export function WaitLine({
  id,
  what,
  done,
  total,
  startedAt,
  seconds,
  note,
}: {
  id?: string;
  what: string;
  done: number;
  total: number;
  startedAt: number;
  seconds: number;
  note?: string;
}) {
  const now = useNow(true, startedAt);
  return (
    <div className="wait-line" id={id} role="status" aria-live="polite">
      <Spinner />
      <div>
        <b>{what}</b>
        {total > 1 ? ` · ${done} of ${total} ready` : ""}
        {seconds > 0 ? ` · ${timeLeft(startedAt, seconds, now)}` : "…"}
        {note && <div className="wait-note">{note}</div>}
      </div>
    </div>
  );
}

/** A small note that stays in view while something works, and says when it's done. Tapping it goes there. */
export function WaitPill({ text, done, problem, onClick }: { text: string; done?: boolean; problem?: boolean; onClick?: () => void }) {
  return (
    <button type="button" className={`wait-pill ${done ? "done" : ""} ${problem ? "problem" : ""}`} onClick={onClick} aria-live="polite">
      {!done && <Spinner />}
      <span>{text}</span>
    </button>
  );
}
