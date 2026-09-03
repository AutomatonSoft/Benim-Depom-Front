"use client";

import { FormEvent, useEffect, useState } from "react";

import { authorizedFetch } from "@/lib/api";
import { TIMEZONE_STORAGE_KEY } from "@/lib/date";

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

function apiError(data: unknown) {
  if (!data || typeof data !== "object") return "Unable to change the password.";
  return Object.entries(data)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" ");
}

export default function SettingsPage() {
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
        setError("Unable to load your profile.");
      }
    }

    void loadProfile();
  }, []);

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
        setPasswordError(apiError(await response.json().catch(() => null)));
        return;
      }

      event.currentTarget.reset();
      setPasswordSuccess("Password changed. Please sign in again.");
      localStorage.removeItem("benim_access_token");
      localStorage.removeItem("benim_refresh_token");
      window.setTimeout(() => window.location.replace("/manager/login"), 1000);
    } catch {
      setPasswordError("Unable to reach the API. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() || profile.username : "Loading...";

  return (
    <section className="content settings-page">
        <header className="topbar">
          <div><p className="eyebrow">Manager panel</p><h1>Settings</h1><p className="products-subtitle">Your account and display preferences</p></div>
        </header>
        {error && <p className="products-message error">{error}</p>}
        <section className="settings-grid">
          <article className="settings-card"><p className="eyebrow">Account</p><h2>Profile</h2><dl><div><dt>Name</dt><dd>{name}</dd></div><div><dt>Username</dt><dd>{profile?.username || "-"}</dd></div><div><dt>Email</dt><dd>{profile?.email || "-"}</dd></div><div><dt>Phone</dt><dd>{profile?.phone || "Not provided"}</dd></div><div><dt>Role</dt><dd>{profile?.role || "-"}</dd></div><div><dt>Email verification</dt><dd>{profile?.is_email_verified ? "Verified" : "Not verified"}</dd></div></dl></article>
          <article className="settings-card"><p className="eyebrow">Display</p><h2>Timezone</h2><p className="settings-copy">All dates in this manager panel are shown in the selected timezone.</p><label>Timezone<select value={timezone} onChange={(event) => changeTimezone(event.target.value)}>{timezones.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><p className="timezone-saved">Saved on this device: {timezone}</p></article>
          <article className="settings-card"><p className="eyebrow">Security</p><h2>Change password</h2><form className="settings-password-form" onSubmit={changePassword}><label>Current password<input required name="current_password" type="password" autoComplete="current-password" /></label><label>New password<input required minLength={8} name="new_password" type="password" autoComplete="new-password" /></label><label>Confirm new password<input required minLength={8} name="new_password_confirm" type="password" autoComplete="new-password" /></label>{passwordError && <p className="form-feedback error" role="alert">{passwordError}</p>}{passwordSuccess && <p className="form-feedback success" role="status">{passwordSuccess}</p>}<button className="password-submit" disabled={submitting} type="submit">{submitting ? "Changing…" : "Change password"}</button></form></article>
        </section>
      </section>
  );
}
