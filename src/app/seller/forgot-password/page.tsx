"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { sellerPublicRequest } from "@/lib/seller";
import { SellerNotice } from "@/components/SellerShell";
import SellerPasswordInput from "@/components/seller/SellerPasswordInput";
import SellerPhoneInput from "@/components/seller/SellerPhoneInput";
import { SellerLocalized } from "@/components/seller/SellerI18n";

export default function SellerForgotPasswordPage() {
  const [stage, setStage] = useState<"request" | "verify" | "complete">("request");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (stage === "request") {
        await sellerPublicRequest("/api/v2/auth/password/reset/request/", { phone, email: email.trim() });
        setStage("verify");
        setNotice("If an account matches this phone number and email, a reset code has been sent to that email.");
      } else if (stage === "verify") {
        const result = await sellerPublicRequest<{ reset_token: string }>("/api/v2/auth/password/reset/verify/", { phone, email: email.trim(), code });
        setResetToken(result.reset_token);
        setStage("complete");
      } else {
        await sellerPublicRequest("/api/v2/auth/password/reset/complete/", {
          reset_token: resetToken,
          new_password: password,
          new_password_confirm: confirm,
        });
        setNotice("Password reset. You can sign in with your new password.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password reset failed.");
    } finally {
      setBusy(false);
    }
  }

  return <SellerLocalized>
    <main className="seller-auth-card">
      <h1>Reset password</h1>
      <p>{stage === "request" ? "Enter your account phone number and email. We will send a reset code to that email." : stage === "verify" ? "Enter the six-digit code sent to your email." : "Choose a new password."}</p>
      <form onSubmit={submit}>
        <div className="seller-field"><label htmlFor="seller-reset-phone">Phone</label>
          <SellerPhoneInput id="seller-reset-phone" autoComplete="tel" required readOnly={stage !== "request"} value={phone} onValueChange={setPhone} />
        </div>
        <label className="seller-field" htmlFor="seller-reset-email">Email
          <input id="seller-reset-email" type="email" autoComplete="email" required readOnly={stage !== "request"} value={email} onChange={event => setEmail(event.target.value)} />
        </label>
        {stage === "verify" && <label className="seller-field">Reset code
          <input inputMode="numeric" minLength={6} maxLength={6} required value={code} onChange={event => setCode(event.target.value)} />
        </label>}
        {stage === "complete" && <>
          <label className="seller-field">New password
            <SellerPasswordInput minLength={8} required autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} />
          </label>
          <label className="seller-field">Confirm new password
            <SellerPasswordInput required autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} />
          </label>
        </>}
        {error && <SellerNotice>{error}</SellerNotice>}
        {notice && <SellerNotice kind="success">{notice}</SellerNotice>}
        <button className="seller-button primary seller-reset-submit" disabled={busy}>
          {busy ? "Please wait…" : stage === "request" ? "Send code" : stage === "verify" ? "Verify code" : "Set new password"}
        </button>
      </form>
      <p className="seller-auth-navigation"><Link className="seller-link" href="/seller/login">Back to sign in</Link></p>
    </main>
  </SellerLocalized>;
}
