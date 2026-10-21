"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import { Avatar, ReaderEditor } from "@/components/Readers";
import { VoiceDesigner } from "@/components/VoiceDesigner";
import { FamilyVoices } from "@/components/FamilyVoices";
import { BackupsPanel } from "@/components/BackupsPanel";
import type { AppStatus, FamilyVoice, Keepsake, Profile } from "@/lib/shared/types";
import type { BackupStatus } from "@/lib/server/offsite";

export function GrownupsView({
  familyName,
  email,
  unlocked,
  pinSet,
  profiles,
  designed,
  keepsakes,
  familyVoices,
  backup,
  backups,
  status,
}: {
  familyName: string;
  email: string;
  unlocked: boolean;
  pinSet: boolean;
  profiles: Profile[];
  designed: { voiceId: string; name: string; description: string }[];
  keepsakes: Keepsake[];
  familyVoices: FamilyVoice[];
  backup: { stories: number; recordings: number; photos: number; bytes: number } | null;
  backups: BackupStatus | null;
  status: AppStatus;
}) {
  const api = useApi();
  const router = useRouter();
  const [editing, setEditing] = useState<Profile | "new" | null>(null);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [designing, setDesigning] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg(ok);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    }
  };

  if (!unlocked) {
    return (
      <div className="parchment center stack">
        <div className="eyebrow">Grown-ups' corner</div>
        <h1>🗝️ This door is locked</h1>
        <p className="muted">Enter the family PIN to change settings.</p>
        <div>
          <button className="btn" onClick={() => act(async () => (await api.askPin()) || Promise.reject(new Error("Still locked.")))}>
            Enter the PIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ ["--gap" as string]: "26px" }}>
      <div className="center">
        <div className="eyebrow">{familyName}</div>
        <h1>Grown-ups' corner</h1>
      </div>
      {msg && <p className="notice center">{msg}</p>}
      {error && <p className="notice notice-error center">{error}</p>}

      <section className="parchment stack">
        <h2>The engines</h2>
        <div className="status-list">
          <div className="status-item">
            <span className={`status-dot ${status.storyteller ? "on" : status.demoMode ? "demo" : "off"}`} />
            <div>
              <b>The storyteller</b>: {status.storyteller ? `connected (${status.storyModel})` : status.demoMode ? "demo stand-in" : "not connected"}
              <div className="small muted">
                Claude reads your photos and writes each story. Set <code>ANTHROPIC_API_KEY</code>.
              </div>
            </div>
          </div>
          <div className="status-item">
            <span className={`status-dot ${status.voices ? "on" : status.demoMode ? "demo" : "off"}`} />
            <div>
              <b>The voices</b>: {status.voices ? `connected (${status.voiceModel})` : status.demoMode ? "demo hum" : "not connected"}
              <div className="small muted">
                ElevenLabs performs every character. Set <code>ELEVENLABS_API_KEY</code>. The Creator plan or higher is
                recommended: a six-minute story uses about 5,000 characters.
              </div>
            </div>
          </div>
        </div>
        {(!status.storyteller || !status.voices) && (
          <p className="small muted" style={{ margin: 0 }}>
            Add the keys to <code>.env.local</code> next to the app (see <code>.env.example</code>) and restart it.
          </p>
        )}
      </section>

      <section className="parchment stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>Readers</h2>
          {editing === null && (
            <button className="btn btn-sm" onClick={() => setEditing("new")}>
              ＋ Add a reader
            </button>
          )}
        </div>
        {editing ? (
          <ReaderEditor
            profile={editing === "new" ? undefined : editing}
            onSaved={() => {
              setEditing(null);
              router.refresh();
            }}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div className="stack" style={{ ["--gap" as string]: "10px" }}>
            {profiles.map((p) => (
              <div key={p.id} className="cast-card spread">
                <div className="row">
                  <Avatar profile={p} size={44} />
                  <div>
                    <div className="cast-name">{p.name}</div>
                    {p.age != null && <div className="small muted">Age {p.age}</div>}
                  </div>
                </div>
                <div className="row">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    onClick={() => confirm(`Remove ${p.name}'s reader card? Their stories stay in the library.`) && act(() => api.del(`/api/profiles/${p.id}`))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {profiles.length === 0 && <p className="muted">No readers yet.</p>}
          </div>
        )}
      </section>

      <section className="parchment stack">
        <h2 style={{ margin: 0 }}>Grown-up PIN</h2>
        <p className="muted" style={{ margin: 0 }}>
          With a PIN, children can listen to anything on the shelves, but making new stories (which uses credits) and changing
          settings needs a grown-up.
        </p>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            void act(() => api.put("/api/pin", { pin }), "PIN saved.").then(() => setPin(""));
          }}
        >
          <input
            className="input"
            inputMode="numeric"
            pattern="\d{4,8}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder={pinSet ? "New PIN" : "4 to 8 digits"}
            style={{ maxWidth: 180 }}
            aria-label="PIN"
          />
          <button className="btn btn-sm" disabled={pin.length < 4}>
            {pinSet ? "Change PIN" : "Set PIN"}
          </button>
          {pinSet && (
            <>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => act(() => api.del("/api/pin"), "Locked. Hand it over!")}>
                🔒 Lock now
              </button>
              <button type="button" className="btn btn-quiet btn-sm" onClick={() => act(() => api.put("/api/pin", { pin: null }), "PIN removed.")}>
                Remove PIN
              </button>
            </>
          )}
        </form>
      </section>

      <FamilyVoices keepsakes={keepsakes} familyVoices={familyVoices} canMakeVoices={status.voices || status.demoMode} />

      <section className="parchment stack">
        <div className="spread">
          <h2 style={{ margin: 0 }}>The voice wardrobe</h2>
          {status.voices && (
            <button className="btn btn-sm" onClick={() => setDesigning(true)}>
              🪄 Conjure a voice
            </button>
          )}
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Voices you conjure (a tiny squeaky mouse, an ancient sleepy dragon) join the cast for every future story. Voices you
          add to your ElevenLabs account from its Voice Library appear here automatically, too.
        </p>
        {designed.length ? (
          <div className="stack" style={{ ["--gap" as string]: "8px" }}>
            {designed.map((v) => (
              <div key={v.voiceId} className="cast-card">
                <div className="cast-name">🪄 {v.name}</div>
                <div className="small muted">{v.description}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="faint small">No conjured voices yet.</p>
        )}
      </section>

      {backups && <BackupsPanel initial={backups} />}

      {backup && (
        <section className="parchment stack">
          <h2 style={{ margin: 0 }}>Keep a copy</h2>
          <p className="muted" style={{ margin: 0 }}>
            One file with every story as an MP3, your family recordings, the book photos, and the words of every story. Open{" "}
            <i>Read me</i> inside to browse and play it all. Keep it somewhere safe, like your computer or a cloud drive: it&apos;s
            yours, whatever happens to the app.
          </p>
          <p className="small" style={{ margin: 0 }}>
            {[
              `${backup.stories} ${backup.stories === 1 ? "story" : "stories"}`,
              `${backup.recordings} family ${backup.recordings === 1 ? "recording" : "recordings"}`,
              `${backup.photos} book ${backup.photos === 1 ? "photo" : "photos"}`,
              backup.bytes < 1024 * 1024 ? "under 1 MB" : `about ${Math.round(backup.bytes / (1024 * 1024))} MB`,
            ].join(" · ")}
          </p>
          <div>
            <a className="btn btn-sm" href="/api/export" download>
              ⬇ Download everything
            </a>
          </div>
          <p className="hint" style={{ margin: 0 }}>On an iPhone or iPad, it lands in the Files app, under Downloads.</p>
        </section>
      )}

      <section className="panel spread">
        <div>
          <b>{familyName}</b>
          <div className="small faint">{email}</div>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            act(async () => {
              await api.post("/api/auth/logout");
              window.location.href = "/welcome";
            })
          }
        >
          Sign out
        </button>
      </section>

      {designing && (
        <VoiceDesigner
          onClose={() => setDesigning(false)}
          onSaved={() => {
            setDesigning(false);
            setMsg("A new voice joined the wardrobe!");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
