"use client";

import { useEffect, useState } from "react";
import { useApi } from "@/components/Grownup";
import type { BackupStatus } from "@/lib/server/offsite";

const megabytes = (bytes: number) => (bytes < 1024 * 1024 ? "under 1 MB" : bytes < 1024 ** 3 ? `${Math.round(bytes / 1024 ** 2)} MB` : `${(bytes / 1024 ** 3).toFixed(1)} GB`);

/** Automatic backups in the Grown-ups' corner: whether they're on, how the last one went, and "Back up now". */
export function BackupsPanel({ initial }: { initial: BackupStatus }) {
  const api = useApi();
  const [status, setStatus] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // Times are shown in the phone's own time zone, so only once the page is on it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const when = (at: number | null) =>
    mounted && at ? new Date(at).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

  // While a backup runs, check on it every few seconds.
  useEffect(() => {
    if (!status.running) return;
    const t = setInterval(() => {
      api.get<BackupStatus>("/api/backups").then(setStatus, () => undefined);
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.running]);

  const backUpNow = async () => {
    setError(null);
    try {
      setStatus(await api.post<BackupStatus>("/api/backups"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The backup couldn't start.");
    }
  };

  const latest = status.recent[0];
  const good = status.lastGood;
  return (
    <div className="stack">
      <h3 className="fold-sub">Every night, automatically</h3>
      {!status.configured ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            <b>Off.</b> Every night, Storyhollow can copy all your stories, family recordings and book photos to cloud storage that&apos;s
            yours, away from the app&apos;s server, so nothing is lost if something goes wrong there. Backblaze B2&apos;s free plan
            holds 10 GB.
          </p>
          <details>
            <summary style={{ cursor: "pointer" }}>How to turn it on</summary>
            <ol className="small" style={{ margin: "10px 0 0", paddingLeft: 20 }}>
              <li>Make a free account at backblaze.com, for B2 Cloud Storage.</li>
              <li>Create a bucket. Make it Private, and give it any name, like &ldquo;storyhollow-backups&rdquo;.</li>
              <li>
                Under Application Keys, add a new key for that bucket only, with read and write access. Note its keyID and applicationKey
                (the second is shown only once).
              </li>
              <li>
                In Railway, open the app&apos;s Variables and add BACKUP_ENDPOINT (the bucket&apos;s Endpoint, like
                s3.us-west-004.backblazeb2.com), BACKUP_BUCKET, BACKUP_KEY_ID and BACKUP_SECRET_KEY (the applicationKey).
              </li>
            </ol>
            <p className="hint" style={{ margin: "8px 0 0" }}>
              The app restarts by itself, and the first backup runs a few minutes later.
            </p>
          </details>
        </>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            ✅ <b>On.</b> Every night, to <b>{status.destination}</b>.
          </p>
          {status.running ? (
            <p className="notice" style={{ margin: 0 }}>
              ✨ Backing up now… the first one can take a while.
            </p>
          ) : (
            latest &&
            !latest.ok && (
              <p className="notice notice-error" style={{ margin: 0 }}>
                The last backup didn&apos;t finish{mounted ? ` (${when(latest.startedAt)})` : ""}: {latest.error ?? "something went wrong."} It will try
                again within the hour.
              </p>
            )
          )}
          <p className="small" style={{ margin: 0 }}>
            {good
              ? `Last backup: ${when(good.finishedAt)} · ${good.totalFiles.toLocaleString()} files · ${megabytes(good.totalBytes)} in all${
                  good.uploadedFiles > 2 ? ` · ${(good.uploadedFiles - 2).toLocaleString()} new` : ""
                }`
              : "No backup yet. The first starts a few minutes after the app does, or start one now."}
          </p>
          <div>
            <button className="btn btn-sm" onClick={backUpNow} disabled={status.running}>
              {status.running ? "Backing up…" : "☁️ Back up now"}
            </button>
          </div>
        </>
      )}
      {error && <p className="notice notice-error">{error}</p>}
    </div>
  );
}
