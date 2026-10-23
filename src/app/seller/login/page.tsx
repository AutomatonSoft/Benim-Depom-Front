"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import SellerPasswordInput from "@/components/seller/SellerPasswordInput";
import { sellerLogin } from "@/lib/seller";

function LoginForm() {
  const { t } = useSellerI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("denied") ? "This portal is available to seller accounts only." : "");
  const [notice] = useState(
    params.get("deletion") === "pending"
      ? "Your account is disabled while marketplace listing removal is being processed."
      : params.get("deletion") === "complete" ? "Your account was deleted." : "",
  );
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sellerLogin(email, password);
      router.replace("/seller/products");
    } catch (error) {
      setError(error instanceof Error ? error.message : t("Sign in failed."));
    } finally {
      setBusy(false);
    }
  }

  return <SellerLocalized><main className="seller-auth-card">
    <h1>{t("Welcome back")}</h1>
    <p>{t("Sign in to manage your products and sales.")}</p>
    {notice && <SellerNotice kind="success">{notice}</SellerNotice>}
    <form onSubmit={submit}>
      <label className="seller-field">{t("Email")}
        <input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} />
      </label>
      <label className="seller-field">{t("Password")}
        <SellerPasswordInput required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
      </label>
      {error && <SellerNotice>{error}</SellerNotice>}
      <button className="seller-button primary seller-login-submit" disabled={busy}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? t("Signing in…") : t("Sign in")}</button>
    </form>
    <p className="seller-auth-navigation"><Link className="seller-link" href="/seller/forgot-password">{t("Forgot password?")}</Link></p>
    <p className="seller-auth-navigation">{t("New to Benim Depom?")} <Link className="seller-link" href="/seller/register">{t("Create seller account")}</Link></p>
  </main></SellerLocalized>;
}

export default function SellerLoginPage() {
  return <SellerLocalized><Suspense fallback={<p className="seller-loading">Loading…</p>}><LoginForm /></Suspense></SellerLocalized>;
}
