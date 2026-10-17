"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "./Grownup";
import { AVATARS, PROFILE_COLORS } from "@/lib/shared/options";
import type { Profile } from "@/lib/shared/types";

export function Avatar({ profile, size = 40 }: { profile: Pick<Profile, "avatar" | "color">; size?: number }) {
  return (
    <span className="avatar" style={{ ["--c" as string]: profile.color, ["--size" as string]: `${size}px` }}>
      {profile.avatar}
    </span>
  );
}

export function ProfilePicker({ profiles, title = "Who's listening tonight?" }: { profiles: Profile[]; title?: string }) {
  const api = useApi();
  const router = useRouter();
  const [adding, setAdding] = useState(profiles.length === 0);

  const choose = async (id: string) => {
    await api.post("/api/profiles/select", { profileId: id });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="center">
      <div className="eyebrow">Welcome to Storyhollow</div>
      <h1>{profiles.length ? title : "Who lives in this library?"}</h1>
      {profiles.length > 0 && (
        <div className="profile-picker">
          {profiles.map((p) => (
            <button key={p.id} className="profile-pick" onClick={() => choose(p.id)}>
              <Avatar profile={p} size={112} />
              {p.name}
            </button>
          ))}
          {!adding && (
            <button className="profile-pick" onClick={() => setAdding(true)} style={{ opacity: 0.75 }}>
              <span className="avatar" style={{ ["--size" as string]: "112px", ["--c" as string]: "#3b2414" }}>
                ＋
              </span>
              Add a reader
            </button>
          )}
        </div>
      )}
      {profiles.length === 0 && (
        <p className="muted" style={{ maxWidth: "32em", margin: "0 auto 24px" }}>
          Give each child their own reader card, with a creature of their choosing, so they can find their favorite
          stories. Grown-ups can have one too.
        </p>
      )}
      {adding && (
        <ReaderEditor
          onSaved={(p) => (profiles.length === 0 ? choose(p.id) : (setAdding(false), router.refresh()))}
          onCancel={profiles.length ? () => setAdding(false) : undefined}
        />
      )}
    </div>
  );
}

export function ReaderEditor({
  profile,
  onSaved,
  onCancel,
}: {
  profile?: Profile;
  onSaved: (p: Profile) => void;
  onCancel?: () => void;
}) {
  const api = useApi();
  const [name, setName] = useState(profile?.name ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? AVATARS[0]);
  const [color, setColor] = useState(profile?.color ?? PROFILE_COLORS[0]);
  const [age, setAge] = useState(profile?.age?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name, avatar, color, age: age ? Number(age) : null };
      const res = profile
        ? await api.patch<{ profile: Profile }>(`/api/profiles/${profile.id}`, body)
        : await api.post<{ profile: Profile }>("/api/profiles", body);
      onSaved(res.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="parchment stack" onSubmit={save} style={{ maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
      <div className="row" style={{ justifyContent: "center" }}>
        <Avatar profile={{ avatar, color }} size={96} />
      </div>
      <label className="field">
        <span>Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mia" required maxLength={30} />
      </label>
      <div>
        <span className="label">Pick a creature</span>
        <div className="chips" role="radiogroup" aria-label="Creature">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              className="chip"
              role="radio"
              aria-checked={a === avatar}
              aria-pressed={a === avatar}
              onClick={() => setAvatar(a)}
              style={{ fontSize: "1.5rem", padding: "4px 10px" }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">And a color</span>
        <div className="chips" role="radiogroup" aria-label="Color">
          {PROFILE_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              role="radio"
              aria-checked={c === color}
              aria-label={c}
              onClick={() => setColor(c)}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: c,
                border: c === color ? "3px solid #3a2616" : "2px solid rgba(255,255,255,.6)",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
      <label className="field">
        <span>Age (optional)</span>
        <input className="input" type="number" min={0} max={110} value={age} onChange={(e) => setAge(e.target.value)} style={{ maxWidth: 120 }} />
        <div className="hint">Helps the storyteller pick just-right words.</div>
      </label>
      {error && <p className="notice notice-error">{error}</p>}
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button className="btn" disabled={busy || !name.trim()}>
          {profile ? "Save" : "Add reader"}
        </button>
      </div>
    </form>
  );
}
