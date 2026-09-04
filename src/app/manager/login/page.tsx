"use client";

import { FormEvent, useState } from "react";

import { useI18n } from "@/i18n";

type LoginResponse = {
  access: string;
  refresh: string;
};

type Profile = {
  role: "seller" | "manager" | "admin";
};

export default function LoginPage() {
  const { t } = useI18n();
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
        setError(t("login.badCredentials"));
        return;
      }

      const tokens = (await loginResponse.json()) as LoginResponse;
      const profileResponse = await fetch("/api/v1/auth/me/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      if (!profileResponse.ok) {
        setError(t("login.verifyFailed"));
        return;
      }

      const profile = (await profileResponse.json()) as Profile;
      if (profile.role !== "manager" && profile.role !== "admin") {
        setError(t("login.managersOnly"));
        return;
      }

      window.localStorage.setItem("benim_access_token", tokens.access);
      window.localStorage.setItem("benim_refresh_token", tokens.refresh);
      window.location.replace("/manager");
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-aside">
        <span className="brand">Benim<span>Depom</span></span>
        <div><p className="eyebrow">{t("common.panel")}</p><h1>{t("login.headline")}</h1><p>{t("login.intro")}</p></div>
        <div className="login-decoration"><span>✓</span> {t("login.badge")}</div>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <p className="eyebrow">{t("login.welcome")}</p>
          <h2>{t("login.title")}</h2>
          <p className="form-intro">{t("login.formIntro")}</p>
          <label>{t("login.email")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
          <label>{t("login.password")}<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-button" disabled={loading}>{loading ? t("login.submitting") : t("login.submit")} <span>→</span></button>
        </form>
      </section>
    </main>
  );
}
