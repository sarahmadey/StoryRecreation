"use client";

import { useEffect, useState } from "react";
import { ApiError, useApi } from "@/components/Grownup";
import { PIN_DIGITS, PinEntry } from "@/components/PinEntry";
import { aboutTime, formatMoney } from "@/lib/shared/art";

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
  /** About how long it takes, in seconds, so nobody wonders afterwards. */
  seconds?: number;
  /** Make the purchase, with the PIN and the price the grown-up said yes to. */
  buy: (approval: { pin: string; micros: number }) => Promise<void>;
}

export function PurchaseDialog({ offer, onDone }: { offer: PurchaseOffer; onDone: (bought: boolean) => void }) {
  const api = useApi();
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  // How many digits the PIN has, so it's checked as soon as it's all in (see PinEntry).
  const [digits, setDigits] = useState<number | null | undefined>(undefined);
  // Choosing a new PIN: the first entry, waiting to be confirmed.
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = offer.each * offer.pictures;

  useEffect(() => {
    api.get<{ pinSet: boolean; digits?: number | null }>("/api/pin").then(
      (r) => {
        setPinSet(r.pinSet);
        setDigits(r.pinSet ? (r.digits ?? null) : PIN_DIGITS);
      },
      () => {
        setPinSet(true);
        setDigits(null);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approve = async (pin: string) => {
    setBusy(true);
    setError(null);
    try {
      await offer.buy({ pin, micros: offer.real ? total : 0 });
      onDone(true);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.code === "pin_needed") {
        setPinSet(false);
        setDigits(PIN_DIGITS);
      } else setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(false);
      return false;
    }
  };

  /** The whole PIN is in: approve with it, or (choosing one) take it, then make sure. */
  const entered = async (pin: string) => {
    if (pinSet) return approve(pin);
    if (first === null) {
      setFirst(pin);
      return true;
    }
    if (first !== pin) {
      setError("Those didn't match. Choose a PIN again.");
      setFirst(null);
      return false;
    }
    setBusy(true);
    try {
      await api.put("/api/pin", { pin });
      setPinSet(true);
      setDigits(pin.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That PIN couldn't be saved.");
      setFirst(null);
      setBusy(false);
      return false;
    }
    return approve(pin);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDone(false);
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
          {offer.seconds ? <div className="small purchase-time">⏱️ Ready in {aboutTime(offer.seconds)}. You can carry on while it works.</div> : null}
        </div>
        {choosing && (
          <p className="small purchase-terms" style={{ margin: 0 }}>
            Four digits you&apos;ll remember. Buying pictures always asks for the family PIN, so little fingers can&apos;t. It also keeps making
            stories and the Grown-ups&apos; corner for grown-ups.
          </p>
        )}
        <PinEntry digits={digits} onComplete={entered} error={error} onType={() => setError(null)} />
        <p style={{ marginTop: 18 }}>
          <button className="btn-quiet btn" type="button" onClick={() => onDone(false)} disabled={busy}>
            Never mind
          </button>
        </p>
      </div>
    </div>
  );
}
