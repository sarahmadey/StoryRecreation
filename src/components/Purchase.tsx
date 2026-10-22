"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, useApi } from "@/components/Grownup";
import { formatMoney } from "@/lib/shared/art";

// Anything that costs money is a purchase: the price is shown first, and a
// grown-up approves it with the family PIN, every time (even while the device
// is unlocked for making stories). A family without a PIN chooses one here.

export interface PurchaseOffer {
  /** What's being bought: "Sketch the tooth fairy (3 tries)". */
  what: string;
  pictures: number;
  /** The most one picture can cost, in millionths of a dollar. */
  each: number;
  /** False while pictures are stand-ins: free, and the price shown is what it would be. */
  real: boolean;
  /** Make the purchase, with the PIN and the price the grown-up said yes to. */
  buy: (approval: { pin: string; micros: number }) => Promise<void>;
}

export function PurchaseDialog({ offer, onDone }: { offer: PurchaseOffer; onDone: (bought: boolean) => void }) {
  const api = useApi();
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  // Choosing a new PIN: the first entry, waiting to be confirmed.
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = offer.each * offer.pictures;

  useEffect(() => {
    api.get<{ pinSet: boolean }>("/api/pin").then(
      (r) => setPinSet(r.pinSet),
      () => setPinSet(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = useCallback(
    async (value: string) => {
      setBusy(true);
      setError(null);
      try {
        await offer.buy({ pin: value, micros: offer.real ? total : 0 });
        onDone(true);
      } catch (err) {
        if (err instanceof ApiError && err.code === "pin_needed") setPinSet(false);
        else setError(err instanceof Error ? err.message : "That didn't work.");
        setPin("");
        setBusy(false);
      }
    },
    [offer, total, onDone],
  );

  const submit = useCallback(async () => {
    if (busy || pin.length < 4 || pinSet === null) return;
    if (pinSet) return approve(pin);
    if (first === null) {
      setFirst(pin);
      setPin("");
      return;
    }
    if (first !== pin) {
      setError("Those didn't match. Choose a PIN again.");
      setFirst(null);
      setPin("");
      return;
    }
    setBusy(true);
    try {
      await api.put("/api/pin", { pin });
      setPinSet(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN couldn't be saved.");
      setFirst(null);
      setPin("");
      setBusy(false);
      return;
    }
    await approve(pin);
  }, [busy, pin, pinSet, first, approve, api]);

  const press = (d: string) => {
    if (busy) return;
    setError(null);
    setPin((p) => (p + d).slice(0, 8));
  };

  // Typing works too, on a computer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Enter") void submit();
      else if (e.key === "Escape") onDone(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const choosing = pinSet === false;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="buy-title">
      <div className="modal parchment center purchase">
        <div className="eyebrow">For grown-ups</div>
        {/* Until it's known whether the family has a PIN, it isn't said which to enter. */}
        <h2 id="buy-title" style={pinSet === null ? { visibility: "hidden" } : undefined}>
          {choosing ? (first === null ? "Choose a family PIN" : "Once more, to be sure") : "Approve this purchase"}
        </h2>
        <div className="purchase-summary">
          <div className="purchase-what">{offer.what}</div>
          <div className="purchase-price">{offer.real ? formatMoney(total) : "Free"}</div>
          <div className="small purchase-terms">
            {offer.real
              ? `${offer.pictures} ${offer.pictures === 1 ? "picture" : "pictures"}, at most ${formatMoney(offer.each)} each, charged to your Google account. Storyhollow never spends more than this.`
              : `Stand-in pictures, while the illustrator isn't set up. With it, this would be about ${formatMoney(total)}.`}
          </div>
        </div>
        {choosing && (
          <p className="small purchase-terms" style={{ margin: 0 }}>
            Buying pictures always asks for the family PIN, so little fingers can&apos;t. It also keeps making stories and the Grown-ups&apos; corner
            for grown-ups.
          </p>
        )}
        <div className="pin-dots" aria-live="polite" aria-label={`${pin.length} digits entered`}>
          {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
            <span key={i} className={i < pin.length ? "on" : ""} />
          ))}
        </div>
        {error && <p className="notice notice-error small">{error}</p>}
        <div className="pin-pad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">
            ⌫
          </button>
          <button type="button" onClick={() => press("0")}>
            0
          </button>
          <button type="button" onClick={() => void submit()} disabled={pin.length < 4 || busy || pinSet === null} aria-label={choosing ? "Next" : "Approve"}>
            ✓
          </button>
        </div>
        <p style={{ marginTop: 18 }}>
          <button className="btn-quiet btn" type="button" onClick={() => onDone(false)} disabled={busy}>
            Never mind
          </button>
        </p>
      </div>
    </div>
  );
}
