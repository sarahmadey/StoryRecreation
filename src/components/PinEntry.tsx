"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/Waiting";

// The family PIN's dots and number pad. Like a phone's passcode, the PIN is
// checked the moment its last digit goes in: there's no ✓ to find.

/** New PINs chosen on the pad are this long. */
export const PIN_DIGITS = 4;

export function PinEntry({
  digits,
  onComplete,
  error,
  onType,
}: {
  /**
   * How many digits the PIN has. Null for a PIN from before its length was kept: it's tried at 4 digits, and a
   * longer one is typed in full and ✓'d (just once: then its length is kept). Undefined while that's being found out.
   */
  digits: number | null | undefined;
  /** Check the PIN. False when it wasn't right: the dots shake, and it's cleared for another go. */
  onComplete: (pin: string) => Promise<boolean>;
  error?: string | null;
  /** A digit was pressed (e.g. to clear the last error). */
  onType?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  // Wrong tries so far: each one shakes the dots.
  const [wrong, setWrong] = useState(0);
  // An older PIN that wasn't right at 4 digits may be longer: it's typed in full, then ✓.
  const [longer, setLonger] = useState(false);
  const manual = digits === null && longer;
  const length = digits === undefined || manual ? null : (digits ?? PIN_DIGITS);

  const check = async (value: string) => {
    setBusy(true);
    const ok = await onComplete(value).catch(() => false);
    setBusy(false);
    setPin("");
    if (!ok) {
      setWrong((n) => n + 1);
      if (digits === null && value.length === PIN_DIGITS) setLonger(true);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    onType?.();
    const next = (pin + d).slice(0, 8);
    setPin(next);
    if (length && next.length === length) void check(next);
  };
  const back = () => !busy && setPin((p) => p.slice(0, -1));
  const enter = () => manual && !busy && pin.length >= PIN_DIGITS && void check(pin);

  // Digits typed while the PIN's length was still being found out are checked once it's known.
  useEffect(() => {
    if (length && pin.length >= length && !busy) void check(pin.slice(0, length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length]);

  // Typing works too, on a computer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") back();
      else if (e.key === "Enter") enter();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div key={wrong} className={`pin-dots ${wrong ? "shake" : ""}`} aria-live="polite" aria-label={`${pin.length} digits entered`}>
        {Array.from({ length: Math.max(length ?? PIN_DIGITS, pin.length) }, (_, i) => (
          <span key={i} className={i < pin.length ? "on" : ""} />
        ))}
      </div>
      <div className="pin-status small" role="status">
        {busy ? (
          <span>
            <Spinner /> Checking…
          </span>
        ) : (
          <>
            {error && <span className="pin-error">{error}</span>}
            {manual && <span>Is your PIN longer than 4 digits? Type all of it, then tap ✓.</span>}
          </>
        )}
      </div>
      <div className="pin-pad">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        {manual ? (
          <button type="button" onClick={enter} disabled={pin.length < PIN_DIGITS || busy} aria-label="Enter the PIN">
            ✓
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => press("0")}>
          0
        </button>
        <button type="button" onClick={back} aria-label="Delete">
          ⌫
        </button>
      </div>
    </>
  );
}
