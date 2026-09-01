"use client";

import { FormEvent, useState } from "react";

type LoginResponse = {
  access: string;
  refresh: string;
};

type Profile = {
  role: "seller" | "manager" | "admin";
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginResponse = await fetch("/api/v1/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!loginResponse.ok) {
        setError("Incorrect email or password.");
        return;
      }

      const tokens = (await loginResponse.json()) as LoginResponse;
      const profileResponse = await fetch("/api/v1/auth/me/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      if (!profileResponse.ok) {
        setError("Unable to verify the account.");
        return;
      }

      const profile = (await profileResponse.json()) as Profile;
      if (profile.role !== "manager" && profile.role !== "admin") {
        setError("This panel is available only to managers.");
        return;
      }

      window.localStorage.setItem("benim_access_token", tokens.access);
      window.localStorage.setItem("benim_refresh_token", tokens.refresh);
      window.location.replace("/manager");
    } catch {
      setError("Unable to reach the API. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-aside">
        <span className="brand">Benim<span>Depom</span></span>
        <div><p className="eyebrow">Manager panel</p><h1>Manage products with confidence.</h1><p>Review seller products, prepare listings and publish them to your marketplaces.</p></div>
        <div className="login-decoration"><span>✓</span> One workspace for your marketplace operations</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <p className="eyebrow">Welcome back</p>
          <h2>Sign in to your account</h2>
          <p className="form-intro">Use your manager credentials to continue.</p>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-button" disabled={loading}>{loading ? "Signing in…" : "Sign in"} <span>→</span></button>
        </form>
      </section>
    </main>
  );
}
