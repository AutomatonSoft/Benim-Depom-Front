"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { clearSellerToken, sellerRequest } from "@/lib/seller";

type AccountDeletionResult = { deleted?: boolean };

export default function SellerSettingsPage() {
  const router = useRouter();
  const [password, setPassword] = useState({ current_password: "", new_password: "", new_password_confirm: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    sellerRequest<{ phone?: string; whatsapp_url?: string | null }>("/api/v1/contact/whatsapp/")
      .then(value => setContact(value.whatsapp_url || ""))
      .catch(() => undefined);
  }, []);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await sellerRequest("/api/v1/auth/password/change/", { method: "POST", body: JSON.stringify(password) });
      setPassword({ current_password: "", new_password: "", new_password_confirm: "" });
      setNotice("Password changed.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await sellerRequest<AccountDeletionResult>("/api/v1/auth/me/", { method: "DELETE" });
      clearSellerToken();
      setDeleteOpen(false);
      router.replace(`/seller/login${result?.deleted === false ? "?deletion=pending" : "?deletion=complete"}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not request account deletion.");
    } finally {
      setBusy(false);
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
            <input type="password" required minLength={key === "current_password" ? 1 : 8} autoComplete={key === "current_password" ? "current-password" : "new-password"} value={password[key]} onChange={event => setPassword(value => ({ ...value, [key]: event.target.value }))} />
          </label>)}
        <Button variant="accent" className="seller-button primary" disabled={busy}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? "Saving…" : "Update password"}</Button>
      </form>

      <section className="seller-card seller-settings-row">
        <div><h2>Notifications</h2><p>See product updates and requests in your notifications.</p></div>
        <Button asChild variant="outline" className="seller-button"><Link href="/seller/notifications">Open notifications</Link></Button>
      </section>

      <section className="seller-card seller-settings-row">
        <div><h2>Support &amp; privacy</h2><p>Contact support using the public Benim Depom WhatsApp details.</p></div>
        <div className="seller-settings-links">
          {contact && <a className="seller-button" href={contact} target="_blank" rel="noreferrer">Contact support on WhatsApp</a>}
          <Link className="seller-link" href="/privacy_policy">Privacy policy</Link>
        </div>
      </section>

      <section className="seller-card seller-danger-zone">
        <div><h2>Delete account</h2><p>Active marketplace listings may be removed before deletion completes. The account can be disabled while that work finishes.</p></div>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild><Button variant="destructive" className="seller-button danger" disabled={busy}>Request account deletion</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your seller account?</AlertDialogTitle>
              <AlertDialogDescription>Active marketplace listings may need to be removed first. Your account may be disabled while removal finishes. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            {error && deleteOpen && <SellerNotice>{error}</SellerNotice>}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <Button variant="destructive" className="seller-button danger" disabled={busy} onClick={() => void deleteAccount()}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? "Please wait…" : "Delete account"}</Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  </SellerPage>;
}
