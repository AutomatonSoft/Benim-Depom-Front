"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { authorizedFetch } from "@/lib/api";
import { useI18n } from "@/i18n";

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

function apiError(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") return fallback;
  return Object.entries(data)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : value}`)
    .join(" ");
}

export default function CreateManagerPage() {
  const { t } = useI18n();
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
      Object.entries(values).filter(
        ([key, value]) => value || key === "username" || key === "email" || key.startsWith("password"),
      ),
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
        setError(apiError(await response.json().catch(() => null), t("managerCreate.failed")));
        return;
      }

      setSuccess(t("managerCreate.success"));
      setValues(initialValues);
    } catch {
      setError(t("common.apiUnreachable"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="content create-manager-page">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t("common.panel")}</p>
            <h1>{t("managerCreate.title")}</h1>
            <p className="products-subtitle">{t("managerCreate.subtitle")}</p>
          </div>
          <Link className="back-link" href="/manager/sellers">{t("managerCreate.back")}</Link>
        </header>

        <form className="manager-form" onSubmit={submit}>
          <section>
            <p className="eyebrow">{t("managerCreate.account")}</p>
            <div className="manager-fields">
              <label>{t("managerCreate.username")}<input required autoComplete="username" value={values.username} onChange={(event) => update("username", event.target.value)} /></label>
              <label>{t("managerCreate.email")}<input required type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} /></label>
              <label>{t("managerCreate.password")}<input required minLength={8} type="password" autoComplete="new-password" value={values.password} onChange={(event) => update("password", event.target.value)} /></label>
              <label>{t("managerCreate.confirmPassword")}<input required minLength={8} type="password" autoComplete="new-password" value={values.password_confirm} onChange={(event) => update("password_confirm", event.target.value)} /></label>
            </div>
          </section>

          <section>
            <p className="eyebrow">{t("managerCreate.profile")}</p>
            <div className="manager-fields">
              <label>{t("managerCreate.firstName")} <small>{t("common.optional")}</small><input autoComplete="given-name" value={values.first_name} onChange={(event) => update("first_name", event.target.value)} /></label>
              <label>{t("managerCreate.lastName")} <small>{t("common.optional")}</small><input autoComplete="family-name" value={values.last_name} onChange={(event) => update("last_name", event.target.value)} /></label>
              <label>{t("managerCreate.phone")} <small>{t("common.optional")}</small><input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} /></label>
              <label>{t("managerCreate.preferredLanguage")} <small>{t("common.optional")}</small><select value={values.preferred_language} onChange={(event) => update("preferred_language", event.target.value)}><option value="de">Deutsch</option><option value="en">English</option><option value="tr">Türkçe</option><option value="ru">Русский</option></select></label>
            </div>
          </section>

          {error && <p className="form-feedback error" role="alert">{error}</p>}
          {success && <p className="form-feedback success" role="status">{success}</p>}
          <button className="create-manager-button" disabled={submitting} type="submit">{submitting ? t("managerCreate.submitting") : t("managerCreate.submit")}</button>
        </form>
      </section>
  );
}
