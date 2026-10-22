"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import { sellerLogin } from "@/lib/seller";

function LoginForm() {
  const { t } = useSellerI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <span className="seller-password-field">
          <input type={showPassword ? "text" : "password"} required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} />
          <button className="seller-password-toggle" type="button" aria-label={t(showPassword ? "Hide password" : "Show password")} onClick={() => setShowPassword(value => !value)}>
            {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
          </button>
        </span>
      </label>
      {error && <SellerNotice>{error}</SellerNotice>}
      <button className="seller-button primary" disabled={busy}>{busy ? t("Signing in…") : t("Sign in")}</button>
    </form>
    <p><Link className="seller-link" href="/seller/forgot-password">{t("Forgot password?")}</Link></p>
    <p>{t("New to Benim Depom?")} <Link className="seller-link" href="/seller/register">{t("Create seller account")}</Link></p>
  </main></SellerLocalized>;
}

export default function SellerLoginPage() {
  return <SellerLocalized><Suspense fallback={<p className="seller-loading">Loading…</p>}><LoginForm /></Suspense></SellerLocalized>;
}
