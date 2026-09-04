"use client";

import { FormEvent, useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/api";
import { TIMEZONE_STORAGE_KEY } from "@/lib/date";
import { localeLabels, useI18n, type Locale } from "@/i18n";

type Profile = {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  is_email_verified: boolean;
};

const timezones = ["UTC", "Asia/Qyzylorda", "Asia/Almaty", "Europe/Istanbul", "Europe/Berlin", "Europe/London"];

function apiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  return Object.entries(data)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" ");
}

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/manager/login");

    async function loadProfile() {
      setTimezone(localStorage.getItem(TIMEZONE_STORAGE_KEY) || "UTC");
      try {
        const response = await authorizedFetch("/api/v1/auth/me/");
        if (response.status === 401) return void window.location.replace("/manager/login");
        if (!response.ok) throw new Error();
        setProfile((await response.json()) as Profile);
      } catch {
        setError(t("settings.loadError"));
      }
    }

    void loadProfile();
  }, [t]);

  function changeTimezone(value: string) {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, value);
    setTimezone(value);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    const form = new FormData(event.currentTarget);
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/manager/login");

    setSubmitting(true);
    try {
      const response = await authorizedFetch("/api/v1/auth/password/change/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: form.get("current_password"),
          new_password: form.get("new_password"),
          new_password_confirm: form.get("new_password_confirm"),
        }),
      });

      if (response.status === 401) {
        localStorage.removeItem("benim_access_token");
        localStorage.removeItem("benim_refresh_token");
        window.location.replace("/manager/login");
        return;
      }

      if (!response.ok) {
        setPasswordError(apiError(await response.json().catch(() => null), t("settings.passwordFailed")));
        return;
      }

      event.currentTarget.reset();
      setPasswordSuccess(t("settings.passwordChanged"));
      localStorage.removeItem("benim_access_token");
      localStorage.removeItem("benim_refresh_token");
      window.setTimeout(() => window.location.replace("/manager/login"), 1000);
    } catch {
      setPasswordError(t("common.apiUnreachable"));
    } finally {
      setSubmitting(false);
    }
  }

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() || profile.username : t("settings.loadingName");

  return (
    <section className="content settings-page">
        <header className="topbar">
          <div><p className="eyebrow">{t("common.panel")}</p><h1>{t("settings.title")}</h1><p className="products-subtitle">{t("settings.subtitle")}</p></div>
        </header>
        {error && <p className="products-message error">{error}</p>}
        <section className="settings-grid">
          <article className="settings-card"><p className="eyebrow">{t("settings.account")}</p><h2>{t("settings.profile")}</h2><dl><div><dt>{t("settings.name")}</dt><dd>{name}</dd></div><div><dt>{t("settings.username")}</dt><dd>{profile?.username || "-"}</dd></div><div><dt>{t("settings.email")}</dt><dd>{profile?.email || "-"}</dd></div><div><dt>{t("settings.phone")}</dt><dd>{profile?.phone || t("common.notProvided")}</dd></div><div><dt>{t("settings.role")}</dt><dd>{profile?.role || "-"}</dd></div><div><dt>{t("settings.emailVerification")}</dt><dd>{profile?.is_email_verified ? t("common.verified") : t("common.notVerified")}</dd></div></dl></article>
          <article className="settings-card"><p className="eyebrow">{t("settings.display")}</p><h2>{t("settings.timezone")}</h2><p className="settings-copy">{t("settings.timezoneCopy")}</p><label>{t("settings.timezone")}<select value={timezone} onChange={(event) => changeTimezone(event.target.value)}>{timezones.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><p className="timezone-saved">{t("settings.timezoneSaved", { tz: timezone })}</p></article>
          <article className="settings-card"><p className="eyebrow">{t("settings.display")}</p><h2>{t("settings.language")}</h2><p className="settings-copy">{t("settings.languageCopy")}</p><label>{t("settings.language")}<select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="en">{localeLabels.en}</option><option value="ru">{localeLabels.ru}</option></select></label><p className="timezone-saved">{t("settings.languageSaved", { language: localeLabels[locale] })}</p></article>
          <article className="settings-card"><p className="eyebrow">{t("settings.security")}</p><h2>{t("settings.changePassword")}</h2><form className="settings-password-form" onSubmit={changePassword}><label>{t("settings.currentPassword")}<input required name="current_password" type="password" autoComplete="current-password" /></label><label>{t("settings.newPassword")}<input required minLength={8} name="new_password" type="password" autoComplete="new-password" /></label><label>{t("settings.confirmNewPassword")}<input required minLength={8} name="new_password_confirm" type="password" autoComplete="new-password" /></label>{passwordError && <p className="form-feedback error" role="alert">{passwordError}</p>}{passwordSuccess && <p className="form-feedback success" role="status">{passwordSuccess}</p>}<button className="password-submit" disabled={submitting} type="submit">{submitting ? t("settings.changing") : t("settings.changePassword")}</button></form></article>
        </section>
      </section>
  );
}
