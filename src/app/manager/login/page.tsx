"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#14325a] via-[#173968] to-[#1f4a7a] px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(247,148,29,0.35), transparent 42%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12), transparent 45%)",
          }}
        />
        <div className="relative">
          <p className="text-[1.6rem] font-extrabold tracking-tight">
            Benim<span className="text-[var(--brand-accent)]">Depom</span>
          </p>
        </div>
        <div className="relative max-w-lg">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-accent)]">{t("common.panel")}</p>
          <h1 className="text-[clamp(2rem,3.2vw,2.75rem)] font-extrabold leading-tight tracking-tight">{t("login.headline")}</h1>
          <p className="mt-4 text-base font-medium text-white/80">{t("login.intro")}</p>
        </div>
        <div className="relative inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 backdrop-blur">
          <ShieldCheck className="size-4 text-[var(--brand-accent)]" aria-hidden />
          {t("login.badge")}
        </div>
      </section>

      <section className="flex items-center justify-center bg-background px-6 py-10">
        <form className="w-full max-w-[420px]" onSubmit={submit}>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand-accent)]">{t("login.welcome")}</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-primary">{t("login.title")}</h2>
          <p className="mt-2 mb-6 text-sm font-medium text-muted-foreground">{t("login.formIntro")}</p>

          <div className="space-y-4">
            <div>
              <Label htmlFor="login-email">{t("login.email")}</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div>
              <Label htmlFor="login-password">{t("login.password")}</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          {error ? (
            <p className="mt-4 text-sm font-bold text-[var(--ui-danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="accent" size="lg" className="mt-6 w-full" disabled={loading}>
            {loading ? t("login.submitting") : t("login.submit")}
            <ArrowRight />
          </Button>
        </form>
      </section>
    </main>
  );
}
