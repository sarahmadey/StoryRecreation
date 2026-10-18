"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/components/Grownup";
import type { SignupMode } from "@/lib/server/signup";

export function WelcomeForm({ signup }: { signup: SignupMode }) {
  const api = useApi();
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">(signup === "closed" ? "login" : "signup");
  const [signupCode, setSignupCode] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") await api.post("/api/auth/signup", { familyName, email, password, signupCode });
      else await api.post("/api/auth/login", { email, password });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="parchment stack" onSubmit={submit} style={{ maxWidth: 520, margin: "0 auto" }}>
      <div className="center">
        <div className="eyebrow">{mode === "signup" ? "Open your family's library" : "Welcome back"}</div>
        <h2>{mode === "signup" ? "Create a library card" : "Sign in"}</h2>
      </div>
      {mode === "signup" && (
        <label className="field">
          <span>Family name</span>
          <input className="input" value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="The Rivera Family" required autoComplete="organization" />
        </label>
      )}
      <label className="field">
        <span>Grown-up's email</span>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        {mode === "signup" && <div className="hint">At least 8 characters. Kids get their own reader cards inside, no passwords needed.</div>}
      </label>
      {mode === "signup" && signup === "code" && (
        <label className="field">
          <span>Sign-up code</span>
          <input className="input" value={signupCode} onChange={(e) => setSignupCode(e.target.value)} required autoComplete="off" />
          <div className="hint">The secret word set when this library was put online.</div>
        </label>
      )}
      {error && <p className="notice notice-error">{error}</p>}
      <div className="center">
        <button className="btn btn-lg" disabled={busy}>
          {busy ? "Opening the doors…" : mode === "signup" ? "Open the library ✨" : "Come in"}
        </button>
      </div>
      {signup !== "closed" && (
        <p className="center small muted">
          {mode === "signup" ? "Already have a library? " : "New here? "}
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
            {mode === "signup" ? "Sign in" : "Create a library card"}
          </button>
        </p>
      )}
    </form>
  );
}
