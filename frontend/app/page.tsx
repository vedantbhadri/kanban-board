"use client";

import { useEffect, useState, type FormEvent } from "react";
import Board from "@/components/board";

export default function Home() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/session")
      .then((response) => response.json())
      .then((session) => setSignedIn(session.authenticated === true))
      .catch(() => { setError("Cannot connect to the server."); setSignedIn(false); });
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Check your username and password." : "Sign in failed. Try again.");
      setPassword("");
      setSignedIn(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    setSignedIn(false);
  }

  if (signedIn === null) return <div className="auth-loading">Loading your board...</div>;
  if (signedIn) return <Board onLogout={signOut} />;

  return <main className="login-screen">
    <div className="login-card">
      <div className="brand"><div className="brand-symbol"><span /><span /><span /><span /></div><span>kanban<span className="brand-period">.</span></span></div>
      <div className="eyebrow"><span /> YOUR WORKSPACE</div>
      <h1>Welcome back<span>.</span></h1>
      <p>Sign in to keep your work moving.</p>
      <form onSubmit={signIn}>
        <label htmlFor="username">Username</label>
        <input id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <label htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <div className="auth-error" role="alert">{error}</div>}
        <button className="save-button" type="submit" disabled={busy}>{busy ? "Signing in..." : "Sign in"}</button>
      </form>
    </div>
  </main>;
}
