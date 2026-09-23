"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, LockKeyhole, ShieldAlert, Trash2 } from "lucide-react";

import { landingFontVars } from "@/components/landing/fonts";
import { useLandingLang } from "@/components/landing/use-landing-lang";
import type { LandingLang } from "@/lib/landing-content";

import "../landing.css";
import "./delete-account.css";

type Copy = {
  eyebrow: string;
  title: string;
  intro: string;
  email: string;
  password: string;
  login: string;
  loggingIn: string;
  loginError: string;
  sellerOnly: string;
  verifyError: string;
  apiError: string;
  confirmTitle: string;
  signedInAs: string;
  warning: string;
  warningDetail: string;
  delete: string;
  deleting: string;
  cancel: string;
  busy: string;
  sessionExpired: string;
  deleteError: string;
  successTitle: string;
  deleted: string;
  pending: string;
  home: string;
};

const COPY: Record<LandingLang, Copy> = {
  de: {
    eyebrow: "KONTO",
    title: "Konto löschen",
    intro: "Melde dich mit deinem Verkäuferkonto an, um die Löschung zu beantragen.",
    email: "E-Mail-Adresse",
    password: "Passwort",
    login: "Weiter",
    loggingIn: "Wird geprüft …",
    loginError: "E-Mail-Adresse oder Passwort ist falsch.",
    sellerOnly: "Die Kontolöschung ist nur für Verkäuferkonten verfügbar.",
    verifyError: "Dein Konto konnte nicht überprüft werden. Bitte versuche es erneut.",
    apiError: "Der Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.",
    confirmTitle: "Möchtest du dein Konto löschen?",
    signedInAs: "Angemeldet als",
    warning: "Diese Aktion kann nicht rückgängig gemacht werden.",
    warningDetail: "Dein Konto und deine Produkte werden gelöscht. Aktive Marktplatzangebote werden zuerst entfernt.",
    delete: "Konto endgültig löschen",
    deleting: "Wird verarbeitet …",
    cancel: "Abbrechen",
    busy: "Für dein Konto laufen noch Marktplatzvorgänge. Bitte warte, bis sie abgeschlossen sind, und versuche es erneut.",
    sessionExpired: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
    deleteError: "Das Konto konnte nicht gelöscht werden. Bitte versuche es erneut.",
    successTitle: "Anfrage erhalten",
    deleted: "Dein Konto wurde gelöscht.",
    pending: "Dein Konto wurde deaktiviert. Es wird automatisch gelöscht, sobald die Marktplatzangebote entfernt sind.",
    home: "Zurück zur Website",
  },
  en: {
    eyebrow: "ACCOUNT",
    title: "Delete account",
    intro: "Sign in to your seller account to request its deletion.",
    email: "Email address",
    password: "Password",
    login: "Continue",
    loggingIn: "Checking…",
    loginError: "The email address or password is incorrect.",
    sellerOnly: "Account deletion is available for seller accounts only.",
    verifyError: "We couldn't verify your account. Please try again.",
    apiError: "The service is unavailable right now. Please try again later.",
    confirmTitle: "Delete your account?",
    signedInAs: "Signed in as",
    warning: "This action cannot be undone.",
    warningDetail: "Your account and products will be deleted. Active marketplace listings will be removed first.",
    delete: "Permanently delete account",
    deleting: "Processing…",
    cancel: "Cancel",
    busy: "Marketplace actions are still running for your account. Wait for them to finish, then try again.",
    sessionExpired: "Your session expired. Please sign in again.",
    deleteError: "We couldn't delete the account. Please try again.",
    successTitle: "Request received",
    deleted: "Your account has been deleted.",
    pending: "Your account has been deactivated. It will be deleted automatically after marketplace listings are removed.",
    home: "Back to website",
  },
  tr: {
    eyebrow: "HESAP",
    title: "Hesabı sil",
    intro: "Hesabınızı silme talebi oluşturmak için satıcı hesabınızla giriş yapın.",
    email: "E-posta adresi",
    password: "Şifre",
    login: "Devam et",
    loggingIn: "Kontrol ediliyor…",
    loginError: "E-posta adresi veya şifre hatalı.",
    sellerOnly: "Hesap silme yalnızca satıcı hesapları için kullanılabilir.",
    verifyError: "Hesabınız doğrulanamadı. Lütfen tekrar deneyin.",
    apiError: "Hizmete şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.",
    confirmTitle: "Hesabınızı silmek istiyor musunuz?",
    signedInAs: "Giriş yapılan hesap",
    warning: "Bu işlem geri alınamaz.",
    warningDetail: "Hesabınız ve ürünleriniz silinir. Aktif pazaryeri ilanları önce kaldırılır.",
    delete: "Hesabı kalıcı olarak sil",
    deleting: "İşleniyor…",
    cancel: "Vazgeç",
    busy: "Hesabınız için devam eden pazaryeri işlemleri var. Tamamlanmalarını bekleyip tekrar deneyin.",
    sessionExpired: "Oturumunuz sona erdi. Lütfen yeniden giriş yapın.",
    deleteError: "Hesap silinemedi. Lütfen tekrar deneyin.",
    successTitle: "Talep alındı",
    deleted: "Hesabınız silindi.",
    pending: "Hesabınız devre dışı bırakıldı. Pazaryeri ilanları kaldırıldıktan sonra otomatik olarak silinecek.",
    home: "Web sitesine dön",
  },
};

type LoginResponse = { access: string };
type ProfileResponse = { role: string; email?: string };

export default function DeleteAccountPage() {
  const [lang] = useLandingLang();
  const copy = COPY[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [step, setStep] = useState<"login" | "confirm" | "complete">("login");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const loginResponse = await fetch("/api/v1/auth/login/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Refresh-Token-Cookie": "seller",
        },
        credentials: "same-origin",
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (!loginResponse.ok) {
        setError(copy.loginError);
        return;
      }

      const tokens = (await loginResponse.json()) as LoginResponse;
      setPassword("");
      const profileResponse = await fetch("/api/v1/auth/me/", {
        headers: { Authorization: `Bearer ${tokens.access}` },
      });

      if (!profileResponse.ok) {
        setError(copy.verifyError);
        return;
      }

      const profile = (await profileResponse.json()) as ProfileResponse;
      if (profile.role !== "seller") {
        setError(copy.sellerOnly);
        return;
      }

      setAccessToken(tokens.access);
      setAccountEmail(profile.email || email.trim());
      setStep("confirm");
    } catch {
      setError(copy.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  async function deleteAccount() {
    if (!accessToken) return;
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/v1/auth/me/", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.status === 204 || response.status === 202) {
        setIsPending(response.status === 202);
        setAccessToken("");
        setStep("complete");
      } else if (response.status === 409) {
        setError(copy.busy);
      } else if (response.status === 401) {
        setAccessToken("");
        setStep("login");
        setError(copy.sessionExpired);
      } else {
        setError(copy.deleteError);
      }
    } catch {
      setError(copy.apiError);
    } finally {
      setIsLoading(false);
    }
  }

  function cancelConfirmation() {
    setAccessToken("");
    setAccountEmail("");
    setError("");
    setStep("login");
  }

  return (
    <div className={`bd-landing ${landingFontVars}`}>
      <header className="site-header">
        <div className="container header-inner">
          <Link className="logo" href="/" aria-label="Benim Depom">
            <span className="logo-wordmark">Benim<span>Depom</span></span>
          </Link>
          <LockKeyhole className="delete-header-icon" aria-hidden="true" />
        </div>
      </header>

      <main className="delete-account-main">
        <section className="delete-account-card" aria-labelledby="delete-title">
          <span className="delete-account-eyebrow"><ShieldAlert aria-hidden="true" />{copy.eyebrow}</span>
          <h1 id="delete-title">{step === "confirm" ? copy.confirmTitle : step === "complete" ? copy.successTitle : copy.title}</h1>
          {step !== "complete" ? (
            <p className="delete-account-intro">
              {step === "login" ? copy.intro : `${copy.signedInAs}: ${accountEmail}`}
            </p>
          ) : null}

          {step === "login" ? (
            <form className="delete-account-form" onSubmit={signIn}>
              <label htmlFor="delete-email">{copy.email}</label>
              <input
                autoComplete="username"
                id="delete-email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              <label htmlFor="delete-password">{copy.password}</label>
              <input
                autoComplete="current-password"
                id="delete-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              {error ? <p className="delete-account-error" role="alert">{error}</p> : null}
              <button className="btn btn-primary btn-block" disabled={isLoading} type="submit">
                {isLoading ? copy.loggingIn : copy.login}<ArrowRight aria-hidden="true" />
              </button>
            </form>
          ) : null}

          {step === "confirm" ? (
            <div className="delete-account-confirm">
              <div className="delete-account-warning">
                <strong>{copy.warning}</strong>
                <p>{copy.warningDetail}</p>
              </div>
              {error ? <p className="delete-account-error" role="alert">{error}</p> : null}
              <button className="btn btn-block delete-account-submit" disabled={isLoading} onClick={deleteAccount} type="button">
                <Trash2 aria-hidden="true" />{isLoading ? copy.deleting : copy.delete}
              </button>
              <button className="delete-account-cancel" disabled={isLoading} onClick={cancelConfirmation} type="button">
                {copy.cancel}
              </button>
            </div>
          ) : null}

          {step === "complete" ? (
            <div className="delete-account-complete">
              <span className="delete-account-check"><Check aria-hidden="true" /></span>
              <p>{isPending ? copy.pending : copy.deleted}</p>
            </div>
          ) : null}

          <Link className="delete-account-home" href="/">{copy.home}</Link>
        </section>
      </main>
    </div>
  );
}
