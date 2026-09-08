"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Feedback, PageContainer, PageHeader, SectionCard, SectionCardHeader } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
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
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
    <PageContainer narrow>
      <PageHeader eyebrow={t("common.panel")} title={t("settings.title")} description={t("settings.subtitle")} />
      {error ? <Feedback className="mb-3">{error}</Feedback> : null}

      <div className="grid gap-4">
        <SectionCard>
          <SectionCardHeader eyebrow={t("settings.account")} title={t("settings.profile")} />
          <dl className="grid gap-3 p-5 sm:grid-cols-2">
            {[
              [t("settings.name"), name],
              [t("settings.username"), profile?.username || "-"],
              [t("settings.email"), profile?.email || "-"],
              [t("settings.phone"), profile?.phone || t("common.notProvided")],
              [t("settings.role"), profile?.role || "-"],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-0.5 border-b border-border/70 pb-3 last:border-0 last:pb-0 sm:last:border-b sm:last:pb-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.04em] text-muted-foreground">{label}</dt>
                <dd className="text-sm font-bold text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader eyebrow={t("settings.display")} title={t("settings.display")} />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-extrabold text-primary">{t("settings.timezone")}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t("settings.timezoneCopy")}</p>
              <Label htmlFor="settings-timezone">{t("settings.timezone")}</Label>
              <FilterSelect id="settings-timezone" value={timezone} onChange={(event) => changeTimezone(event.target.value)}>
                {timezones.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>
              <p className="mt-2 text-xs font-semibold text-[var(--ui-success)]">{t("settings.timezoneSaved", { tz: timezone })}</p>
            </div>
            <div>
              <h3 className="mb-1 text-sm font-extrabold text-primary">{t("settings.language")}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{t("settings.languageCopy")}</p>
              <Label htmlFor="settings-language">{t("settings.language")}</Label>
              <FilterSelect id="settings-language" value={locale} onChange={(event) => setLocale(event.target.value as Locale)}>
                <option value="en">{localeLabels.en}</option>
                <option value="ru">{localeLabels.ru}</option>
              </FilterSelect>
              <p className="mt-2 text-xs font-semibold text-[var(--ui-success)]">{t("settings.languageSaved", { language: localeLabels[locale] })}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader eyebrow={t("settings.security")} title={t("settings.changePassword")} />
          <form className="grid max-w-md gap-3 p-5" onSubmit={changePassword}>
            <div>
              <Label htmlFor="current_password">{t("settings.currentPassword")}</Label>
              <div className="relative">
                <Input
                  required
                  id="current_password"
                  name="current_password"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-11"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={t("settings.currentPassword")}
                  aria-pressed={showCurrent}
                  onClick={() => setShowCurrent((value) => !value)}
                >
                  {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="new_password">{t("settings.newPassword")}</Label>
              <div className="relative">
                <Input
                  required
                  minLength={8}
                  id="new_password"
                  name="new_password"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-11"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={t("settings.newPassword")}
                  aria-pressed={showNew}
                  onClick={() => setShowNew((value) => !value)}
                >
                  {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="new_password_confirm">{t("settings.confirmNewPassword")}</Label>
              <div className="relative">
                <Input
                  required
                  minLength={8}
                  id="new_password_confirm"
                  name="new_password_confirm"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-11"
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={t("settings.confirmNewPassword")}
                  aria-pressed={showConfirm}
                  onClick={() => setShowConfirm((value) => !value)}
                >
                  {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            {passwordError ? <Feedback>{passwordError}</Feedback> : null}
            {passwordSuccess ? <Feedback tone="success">{passwordSuccess}</Feedback> : null}
            <div className="flex justify-end">
              <Button type="submit" variant="accent" disabled={submitting}>
                {submitting ? t("settings.changing") : t("settings.changePassword")}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </PageContainer>
  );
}
