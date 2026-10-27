"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, MessageCircle, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SellerSelect } from "@/components/seller/SellerSelect";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SellerNotice, SellerPage } from "@/components/SellerShell";
import { clearSellerSession, SellerApiError, sellerRequest } from "@/lib/seller";
import { sellerApiErrorDetails } from "@/lib/seller-error-messages";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { readSellerLocale, setSellerLocale, type SellerLocale } from "@/lib/seller-i18n";

type AccountDeletionResult = { deleted?: boolean };
const languages = [
  { value: "ru", label: "Русский" },
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
  { value: "de", label: "Deutsch" },
] satisfies { value: SellerLocale; label: string }[];

export default function SellerSettingsPage() {
  const router = useRouter();
  const { t, locale } = useSellerI18n();
  const deletionInFlight = useRef(false);
  const [password, setPassword] = useState({ current_password: "", new_password: "", new_password_confirm: "" });
  const [error, setError] = useState("");
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [languageLoading, setLanguageLoading] = useState(true);
  const [languageBusy, setLanguageBusy] = useState(false);
  const [languageError, setLanguageError] = useState("");

  useEffect(() => {
    sellerRequest<{ phone?: string; whatsapp_url?: string | null }>("/api/v2/contact/whatsapp/")
      .then(value => setContact(value.whatsapp_url || ""))
      .catch(() => undefined);
    sellerRequest<{ preferred_language?: string }>("/api/v2/auth/me/")
      .then(value => { if (value.preferred_language) setSellerLocale(readSellerLocale(value.preferred_language)); })
      .catch(() => undefined)
      .finally(() => setLanguageLoading(false));
  }, []);

  async function changeLanguage(value: string) {
    const language = readSellerLocale(value);
    setLanguageBusy(true);
    setLanguageError("");
    try {
      await sellerRequest("/api/v2/auth/me/language/", { method: "PATCH", body: JSON.stringify({ language }) });
      setSellerLocale(language);
    } catch {
      setLanguageError("Could not update interface language.");
    } finally {
      setLanguageBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    setPasswordErrors({});
    try {
      await sellerRequest("/api/v2/auth/password/change/", { method: "POST", body: JSON.stringify(password) });
      setPassword({ current_password: "", new_password: "", new_password_confirm: "" });
      setNotice("Password changed.");
    } catch (error) {
      if (error instanceof SellerApiError) setPasswordErrors(sellerApiErrorDetails(error.data, error.status).fields);
      setError(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (deletionInFlight.current) return;
    deletionInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sellerRequest<AccountDeletionResult>("/api/v2/auth/me/", { method: "DELETE" });
      clearSellerSession();
      setDeleteOpen(false);
      router.replace(`/seller/login${result?.deleted === false ? "?deletion=pending" : "?deletion=complete"}`);
    } catch (error) {
      deletionInFlight.current = false;
      setError(error instanceof Error ? error.message : "Could not request account deletion.");
    } finally {
      if (!deletionInFlight.current) setBusy(false);
    }
  }

  return <SellerPage title="Settings" description="Security, account and support settings.">
    <div className="seller-stack seller-page-narrow">
      {error && !deleteOpen && <SellerNotice>{error}</SellerNotice>}
      {notice && <SellerNotice kind="success">{notice}</SellerNotice>}
      <form className="seller-card seller-form-grid" onSubmit={changePassword}>
        <div><h2>Change password</h2><p>Choose a password you do not use on other sites.</p></div>
        {([ ["current_password", "Current password"], ["new_password", "New password"], ["new_password_confirm", "Confirm new password"] ] as const).map(([key, label]) =>
          <label key={key} className="seller-field">{label}
            <input type="password" required minLength={key === "current_password" ? 1 : 8} aria-invalid={Boolean(passwordErrors[key])} autoComplete={key === "current_password" ? "current-password" : "new-password"} value={password[key]} onChange={event => {
              setPasswordErrors(current => { const next = { ...current }; delete next[key]; return next; });
              setPassword(value => ({ ...value, [key]: event.target.value }));
            }} />
            {passwordErrors[key] && <small className="seller-field-error">{passwordErrors[key]}</small>}
          </label>)}
        <Button variant="accent" className="seller-button primary seller-settings-password-submit" disabled={busy}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? "Saving…" : "Update password"}</Button>
      </form>

      <section className="seller-card seller-settings-row seller-settings-language">
        <div><h2>{t("Interface language")}</h2><p>{t("Choose the language used across the seller portal.")}</p></div>
        <div className="seller-settings-language-control">
          <SellerSelect ariaLabel={t("Interface language")} value={locale} onValueChange={value => void changeLanguage(value)} disabled={busy || languageLoading || languageBusy} placeholder={t("Interface language")} options={languages} />
          {(languageLoading || languageBusy) && <span role="status">{t(languageLoading ? "Loading…" : "Saving…")}</span>}
          {languageError && <SellerNotice>{t(languageError)}</SellerNotice>}
        </div>
      </section>

      <section className="seller-card seller-support-card">
        <h2>Support &amp; privacy</h2>
        <div className="seller-settings-link-list">
          {contact ? <a className="seller-settings-link-row" href={contact} target="_blank" rel="noopener noreferrer">
            <span className="seller-settings-link-layout"><span className="seller-settings-row-icon whatsapp"><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" /></span><span className="seller-settings-row-copy"><strong>Contact us</strong><small>Write to our support team.</small></span><ChevronRight size={19} aria-hidden="true" /></span>
          </a> : <div className="seller-settings-link-row" aria-disabled="true">
            <span className="seller-settings-link-layout"><span className="seller-settings-row-icon whatsapp"><MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" /></span><span className="seller-settings-row-copy"><strong>Contact us</strong><small>Write to our support team.</small></span><ChevronRight size={19} aria-hidden="true" /></span>
          </div>}
          <Link className="seller-settings-link-row" href="/privacy_policy">
            <span className="seller-settings-link-layout"><span className="seller-settings-row-icon"><ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" /></span><span className="seller-settings-row-copy"><strong>Privacy policy</strong><small>How we use and protect your data.</small></span><ChevronRight size={19} aria-hidden="true" /></span>
          </Link>
        </div>
      </section>

      <section className="seller-card seller-danger-zone">
        <div><h2>{t("Delete account")}</h2><p>{t("Marketplace listings may need processing before deletion can finish. Your account may be disabled during this time.")}</p></div>
        <AlertDialog open={deleteOpen} onOpenChange={open => { if (!deletionInFlight.current) { setDeleteOpen(open); setError(""); } }}>
          <AlertDialogTrigger asChild><Button variant="destructive" className="seller-button danger seller-delete-trigger" disabled={busy}>{t("Delete account")}</Button></AlertDialogTrigger>
          <AlertDialogContent className="seller-delete-dialog" size="sm">
            <AlertDialogHeader>
              <span className="seller-delete-icon"><TriangleAlert size={24} aria-hidden="true" /></span>
              <AlertDialogTitle>{t("Delete account?")}</AlertDialogTitle>
              <AlertDialogDescription>{t("Are you sure you want to delete your account? You will lose access to your products and seller workspace. Deletion may be irreversible.")}</AlertDialogDescription>
            </AlertDialogHeader>
            {error && deleteOpen && <SellerNotice>{error}</SellerNotice>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>{t("Cancel")}</AlertDialogCancel>
              <Button variant="destructive" className="seller-button danger seller-delete-confirm" disabled={busy} onClick={() => void deleteAccount()}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{t(busy ? "Please wait…" : "Delete account")}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  </SellerPage>;
}
