"use client";

import { useEffect, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { TIMEZONE_STORAGE_KEY } from "@/lib/date";

type Profile = { username: string; email: string; first_name: string; last_name: string; phone: string; role: string; is_email_verified: boolean };

const timezones = ["UTC", "Asia/Qyzylorda", "Asia/Almaty", "Europe/Istanbul", "Europe/Berlin", "Europe/London"];

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [timezone, setTimezone] = useState("UTC");
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("benim_access_token");
    if (!token) return void window.location.replace("/login");
    async function loadProfile() {
      setTimezone(localStorage.getItem(TIMEZONE_STORAGE_KEY) || "UTC");
      try {
        const response = await fetch("/api/v1/auth/me/", { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 401) return void window.location.replace("/login");
        if (!response.ok) throw new Error();
        setProfile(await response.json() as Profile);
      } catch { setError("Unable to load your profile."); }
    }
    void loadProfile();
  }, []);

  function changeTimezone(value: string) {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, value);
    setTimezone(value);
  }

  const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() || profile.username : "Loading...";
  return <main className="app-shell"><Sidebar active="settings" /><section className="content settings-page"><header className="topbar"><div><p className="eyebrow">Manager panel</p><h1>Settings</h1><p className="products-subtitle">Your account and display preferences</p></div></header>
    {error && <p className="products-message error">{error}</p>}
    <section className="settings-grid"><article className="settings-card"><p className="eyebrow">Account</p><h2>Profile</h2><dl><div><dt>Name</dt><dd>{name}</dd></div><div><dt>Username</dt><dd>{profile?.username || "-"}</dd></div><div><dt>Email</dt><dd>{profile?.email || "-"}</dd></div><div><dt>Phone</dt><dd>{profile?.phone || "Not provided"}</dd></div><div><dt>Role</dt><dd>{profile?.role || "-"}</dd></div><div><dt>Email verification</dt><dd>{profile?.is_email_verified ? "Verified" : "Not verified"}</dd></div></dl></article>
      <article className="settings-card"><p className="eyebrow">Display</p><h2>Timezone</h2><p className="settings-copy">All dates in this manager panel are shown in the selected timezone.</p><label>Timezone<select value={timezone} onChange={(event) => changeTimezone(event.target.value)}>{timezones.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><p className="timezone-saved">Saved on this device: {timezone}</p></article>
      <article className="settings-card"><p className="eyebrow">Security</p><h2>Password</h2><p className="settings-copy">Password changes require a secure backend endpoint. This section will be enabled when that endpoint is added.</p><button disabled>Change password</button></article></section>
  </section></main>;
}