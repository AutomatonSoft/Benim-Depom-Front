"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { sellerPublicRequest } from "@/lib/seller";
import { SellerNotice } from "@/components/SellerShell";
import { SellerLocalized, useSellerI18n } from "@/components/seller/SellerI18n";
import { SellerSelect } from "@/components/seller/SellerSelect";
import SellerPasswordInput from "@/components/seller/SellerPasswordInput";

export default function SellerRegisterPage() {
  const router = useRouter();
  const { t } = useSellerI18n();
  const [form, setForm] = useState({ username: "", email: "", password: "", password_confirm: "", first_name: "", last_name: "", phone: "", preferred_language: "en" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sellerPublicRequest("/api/v1/auth/register/", form);
      router.push(`/seller/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : t("Registration failed."));
    } finally {
      setBusy(false);
    }
  }

  const text = (key: keyof typeof form, label: string, type = "text", autocomplete: string = key) => {
    const props = { required: key !== "phone", autoComplete: autocomplete, value: form[key], onChange: (event: ChangeEvent<HTMLInputElement>) => setForm(current => ({ ...current, [key]: event.target.value })) };
    return <label className="seller-field">{t(label)}{type === "password" ? <SellerPasswordInput {...props} /> : <input {...props} type={type} />}</label>;
  };

  return <SellerLocalized><main className="seller-auth-card seller-registration-card">
    <h1>{t("Create seller account")}</h1>
    <p>{t("Use your business details to register.")}</p>
    <form onSubmit={submit}>
      {text("username", "Username", "text", "username")}
      {text("email", "Email", "email", "email")}
      <div className="seller-field-row">{text("first_name", "First name", "text", "given-name")}{text("last_name", "Last name", "text", "family-name")}</div>
      {text("phone", "Phone", "tel", "tel")}
      {text("password", "Password", "password", "new-password")}
      {text("password_confirm", "Confirm password", "password", "new-password")}
      <label className="seller-field">{t("Preferred language")}
        <SellerSelect value={form.preferred_language} onValueChange={value => setForm(current => ({ ...current, preferred_language: value }))} placeholder="English" ariaLabel={t("Preferred language")} options={[{ value: "en", label: "English" }, { value: "tr", label: "Türkçe" }, { value: "ru", label: "Русский" }, { value: "de", label: "Deutsch" }]} />
      </label>
      {error && <SellerNotice>{error}</SellerNotice>}
      <button className="seller-button primary" disabled={busy}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} aria-hidden="true" />{t(busy ? "Creating…" : "Create account")}</button>
    </form>
    <p className="seller-auth-navigation">{t("Already registered?")} <Link className="seller-link" href="/seller/login">{t("Sign in")}</Link></p>
  </main></SellerLocalized>;
}
