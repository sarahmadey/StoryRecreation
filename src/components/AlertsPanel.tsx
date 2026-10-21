"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/Grownup";
import type { AlertsStatus } from "@/lib/server/alerts";

/** Problem alerts in the Grown-ups' corner: whether they're on, a test email, the last few sent, and watching the app itself. */
export function AlertsPanel({ initial }: { initial: AlertsStatus }) {
  const api = useApi();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  // Times and this page's own address are known only once it's on the phone.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => setOrigin(window.location.origin), []);
  const when = (at: number) =>
    origin ? new Date(at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  const sendTest = async () => {
    setBusy(true);
    setNote(null);
    try {
      setStatus(await api.post<AlertsStatus>("/api/alerts"));
      setNote({ ok: true, text: `Sent to ${status.to}. It can take a minute to arrive; check spam the first time.` });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : "The test email didn't go." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="parchment stack">
      <h2 style={{ margin: 0 }}>Problem alerts</h2>
      {!status.configured ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            <b>Off.</b> Storyhollow can email you when a story doesn&apos;t finish, a nightly backup fails, or voice credits run low, so you
            hear about it before bedtime. It uses Resend, which is free for this.
          </p>
          <details>
            <summary style={{ cursor: "pointer" }}>How to turn it on</summary>
            <ol className="small" style={{ margin: "10px 0 0", paddingLeft: 20 }}>
              <li>Make a free account at resend.com, with the email address the alerts should go to.</li>
              <li>Under API Keys, create a key with &ldquo;Sending access&rdquo;. Copy it (it&apos;s shown only once).</li>
              <li>In Railway, open the app&apos;s Variables and add RESEND_API_KEY (the key) and ALERT_EMAIL (that same email address).</li>
            </ol>
            <p className="hint" style={{ margin: "8px 0 0" }}>
              The app restarts by itself. Then come back here and send a test email.
            </p>
          </details>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            ✅ <b>On.</b> Emails go to <b>{status.to}</b> when a story doesn&apos;t finish, a backup fails, or voice credits run low.
          </p>
          <div>
            <button className="btn btn-sm" onClick={sendTest} disabled={busy}>
              {busy ? "Sending…" : "✉️ Send a test email"}
            </button>
          </div>
          {note && (
            <p className={`notice small ${note.ok ? "" : "notice-error"}`} style={{ margin: 0 }}>
              {note.text}
            </p>
          )}
          {status.recent.length > 0 && (
            <div className="small">
              <div className="find-label" style={{ color: "var(--ink-soft)" }}>
                Recently sent
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {status.recent.map((a) => (
                  <li key={`${a.sentAt}-${a.subject}`}>
                    {when(a.sentAt)} · {a.subject.replace(/^.*?Storyhollow: /, "")}
                    {a.ok ? "" : ` · not sent (${a.error ?? "error"})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      <details>
        <summary style={{ cursor: "pointer" }}>Be told if the app itself stops working</summary>
        <p className="small" style={{ margin: "10px 0 0" }}>
          If the app is down it can&apos;t send an email, so let a free outside service keep an eye on it. Make an account at uptimerobot.com,
          add an HTTP(s) monitor for the address below, checking every 5 minutes, and it emails you if the app stops answering.
        </p>
        <p className="small" style={{ margin: "8px 0 0" }}>
          <code style={{ wordBreak: "break-all" }}>{origin ? `${origin}/api/health` : "/api/health"}</code>
        </p>
      </details>
    </section>
  );
}
