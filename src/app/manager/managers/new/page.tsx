"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import Sidebar from "@/components/Sidebar";
import { authorizedFetch } from "@/lib/api";

type FormValues = {
  username: string;
  password: string;
  password_confirm: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  preferred_language: string;
};

const initialValues: FormValues = {
  username: "",
  password: "",
  password_confirm: "",
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  preferred_language: "de",
};

function apiError(data: unknown) {
  if (!data || typeof data !== "object") return "Unable to create the manager.";
  return Object.entries(data)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" ");
}

export default function CreateManagerPage() {
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const access = window.localStorage.getItem("benim_access_token");
    if (!access) {
      window.location.replace("/manager/login");
      return;
    }

    setSubmitting(true);
    const payload = Object.fromEntries(
      Object.entries(values).filter(([key, value]) => value || key === "username" || key.startsWith("password")),
    );

    try {
      const response = await authorizedFetch("/api/v1/manager/users/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        window.localStorage.removeItem("benim_access_token");
        window.localStorage.removeItem("benim_refresh_token");
        window.location.replace("/manager/login");
        return;
      }

      if (!response.ok) {
        setError(apiError(await response.json().catch(() => null)));
        return;
      }

      setSuccess("Manager account created successfully.");
      setValues(initialValues);
    } catch {
      setError("Unable to reach the API. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar active="sellers" />
      <section className="content create-manager-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">Manager panel</p>
            <h1>Create manager</h1>
            <p className="products-subtitle">Create an account for a new member of the management team.</p>
          </div>
          <Link className="back-link" href="/manager/sellers">← Sellers</Link>
        </header>

        <form className="manager-form" onSubmit={submit}>
          <section>
            <p className="eyebrow">Account</p>
            <div className="manager-fields">
              <label>Username<input required autoComplete="username" value={values.username} onChange={(event) => update("username", event.target.value)} /></label>
              <label>Email <small>Optional</small><input type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label>Password<input required minLength={8} type="password" autoComplete="new-password" value={values.password} onChange={(event) => update("password", event.target.value)} /></label>
              <label>Confirm password<input required minLength={8} type="password" autoComplete="new-password" value={values.password_confirm} onChange={(event) => update("password_confirm", event.target.value)} /></label>
            </div>
          </section>

          <section>
            <p className="eyebrow">Profile</p>
            <div className="manager-fields">
              <label>First name <small>Optional</small><input autoComplete="given-name" value={values.first_name} onChange={(event) => update("first_name", event.target.value)} /></label>
              <label>Last name <small>Optional</small><input autoComplete="family-name" value={values.last_name} onChange={(event) => update("last_name", event.target.value)} /></label>
              <label>Phone <small>Optional</small><input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label>Preferred language <small>Optional</small><select value={values.preferred_language} onChange={(event) => update("preferred_language", event.target.value)}><option value="de">Deutsch</option><option value="en">English</option><option value="tr">Türkçe</option><option value="ru">Русский</option></select></label>
            </div>
          </section>

          {error && <p className="form-feedback error" role="alert">{error}</p>}
          {success && <p className="form-feedback success" role="status">{success}</p>}
          <button className="create-manager-button" disabled={submitting} type="submit">{submitting ? "Creating…" : "Create manager"}</button>
        </form>
      </section>
    </main>
  );
}
