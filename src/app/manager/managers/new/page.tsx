"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Feedback, PageContainer, PageHeader, SectionCard, SectionCardHeader } from "@/components/manager/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FilterSelect } from "@/components/ui/filter-select";
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

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
      Object.entries(values).filter(([key, value]) => value || key === "username" || key === "email" || key.startsWith("password")),
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
    <PageContainer narrow>
      <PageHeader
        eyebrow={t("common.panel")}
        title={t("managerCreate.title")}
        description={t("managerCreate.subtitle")}
        secondaryActions={
          <Button asChild variant="secondary">
            <Link href="/manager/sellers">{t("managerCreate.back")}</Link>
          </Button>
        }
      />

      <form className="grid gap-4" onSubmit={submit}>
        <SectionCard>
          <SectionCardHeader eyebrow={t("managerCreate.account")} title={t("managerCreate.account")} />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="username">{t("managerCreate.username")}</Label>
              <Input required id="username" autoComplete="username" value={values.username} onChange={(event) => update("username", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">{t("managerCreate.email")}</Label>
              <Input required id="email" type="email" autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("managerCreate.password")}</Label>
              <div className="relative">
                <Input
                  required
                  minLength={8}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-11"
                  value={values.password}
                  onChange={(event) => update("password", event.target.value)}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={t("managerCreate.password")}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label htmlFor="password_confirm">{t("managerCreate.confirmPassword")}</Label>
              <div className="relative">
                <Input
                  required
                  minLength={8}
                  id="password_confirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  className="pr-11"
                  value={values.password_confirm}
                  onChange={(event) => update("password_confirm", event.target.value)}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={t("managerCreate.confirmPassword")}
                  aria-pressed={showPasswordConfirm}
                  onClick={() => setShowPasswordConfirm((value) => !value)}
                >
                  {showPasswordConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <SectionCardHeader eyebrow={t("managerCreate.profile")} title={t("managerCreate.profile")} />
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="first_name">
                {t("managerCreate.firstName")} <span className="normal-case tracking-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="first_name" autoComplete="given-name" value={values.first_name} onChange={(event) => update("first_name", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="last_name">
                {t("managerCreate.lastName")} <span className="normal-case tracking-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="last_name" autoComplete="family-name" value={values.last_name} onChange={(event) => update("last_name", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone">
                {t("managerCreate.phone")} <span className="normal-case tracking-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <Input id="phone" type="tel" autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="preferred_language">
                {t("managerCreate.preferredLanguage")} <span className="normal-case tracking-normal text-muted-foreground">({t("common.optional")})</span>
              </Label>
              <FilterSelect id="preferred_language" value={values.preferred_language} onChange={(event) => update("preferred_language", event.target.value)}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
                <option value="tr">Türkçe</option>
                <option value="ru">Русский</option>
              </FilterSelect>
            </div>
          </div>
        </SectionCard>

        {error ? <Feedback>{error}</Feedback> : null}
        {success ? <Feedback tone="success">{success}</Feedback> : null}
        <div className="flex justify-end">
          <Button type="submit" variant="accent" disabled={submitting}>
            {submitting ? t("managerCreate.submitting") : t("managerCreate.submit")}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
