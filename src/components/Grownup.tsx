"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// Every API call goes through `useApi()`. If the server says a grown-up is
// needed (a PIN is set and the device isn't unlocked), a PIN pad appears and
// the request is retried automatically once it's entered.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

type Requester = <T = unknown>(url: string, init?: RequestInit & { json?: unknown }) => Promise<T>;

const GrownupContext = createContext<{ request: Requester; askPin: () => Promise<boolean> } | null>(null);

export function useApi() {
  const ctx = useContext(GrownupContext);
  if (!ctx) throw new Error("useApi must be used inside <GrownupProvider>");
  const { request } = ctx;
  return {
    get: <T,>(url: string) => request<T>(url),
    post: <T,>(url: string, json?: unknown) => request<T>(url, { method: "POST", json: json ?? {} }),
    patch: <T,>(url: string, json: unknown) => request<T>(url, { method: "PATCH", json }),
    put: <T,>(url: string, json: unknown) => request<T>(url, { method: "PUT", json }),
    del: <T,>(url: string) => request<T>(url, { method: "DELETE" }),
    form: <T,>(url: string, body: FormData, method = "POST") => request<T>(url, { method, body }),
    askPin: ctx.askPin,
  };
}

async function rawRequest<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code);
  return data as T;
}

export function GrownupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const waiters = useRef<((ok: boolean) => void)[]>([]);

  const askPin = useCallback(() => {
    setOpen(true);
    return new Promise<boolean>((resolve) => waiters.current.push(resolve));
  }, []);

  const finish = (ok: boolean) => {
    setOpen(false);
    const w = waiters.current;
    waiters.current = [];
    w.forEach((fn) => fn(ok));
  };

  const request: Requester = useCallback(
    async <T,>(url: string, init?: RequestInit & { json?: unknown }) => {
      try {
        return await rawRequest<T>(url, init);
      } catch (err) {
        if (err instanceof ApiError && err.code === "pin_required") {
          if (await askPin()) return rawRequest<T>(url, init);
        }
        if (err instanceof ApiError && err.code === "signed_out") window.location.href = "/welcome";
        throw err;
      }
    },
    [askPin],
  ) as Requester;

  return (
    <GrownupContext.Provider value={{ request, askPin }}>
      {children}
      {open && <PinPad onDone={finish} />}
    </GrownupContext.Provider>
  );
}

function PinPad({ onDone }: { onDone: (ok: boolean) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      await rawRequest("/api/pin", { method: "POST", json: { pin: value } });
      onDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    setError(null);
    const next = (pin + d).slice(0, 8);
    setPin(next);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-title">
      <div className="modal parchment center">
        <div className="eyebrow">For grown-ups</div>
        <h2 id="pin-title">Enter the family PIN</h2>
        <p className="muted small">Making new stories uses storytelling credits, so a grown-up needs to say yes.</p>
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
          <button type="button" onClick={() => setPin(pin.slice(0, -1))} aria-label="Delete">
            ⌫
          </button>
          <button type="button" onClick={() => press("0")}>
            0
          </button>
          <button type="button" onClick={() => submit(pin)} disabled={pin.length < 4 || busy} aria-label="Unlock">
            ✓
          </button>
        </div>
        <p style={{ marginTop: 18 }}>
          <button className="btn-quiet btn" type="button" onClick={() => onDone(false)}>
            Never mind
          </button>
        </p>
      </div>
    </div>
  );
}
