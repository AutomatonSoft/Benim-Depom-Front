"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { sellerRequest, type SellerProfile } from "@/lib/seller";
import { readSellerLocale, setSellerLocale } from "@/lib/seller-i18n";

const languages = [["en", "English"], ["tr", "Türkçe"], ["ru", "Русский"], ["de", "Deutsch"]] as const;

export default function SellerProfilePage() {
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", preferred_language: "en" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sellerRequest<SellerProfile>("/api/v1/auth/me/").then(value => {
      setProfile(value);
      setForm({
        first_name: value.first_name || "", last_name: value.last_name || "", email: value.email || "",
        phone: value.phone || "", preferred_language: value.preferred_language || "en",
      });
    }).catch(value => setError(value instanceof Error ? value.message : "Could not load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const { preferred_language, ...fields } = form;
      await sellerRequest("/api/v1/auth/me/", { method: "PATCH", body: JSON.stringify(fields) });
      await sellerRequest("/api/v1/auth/me/language/", { method: "PATCH", body: JSON.stringify({ language: preferred_language }) });
      setSellerLocale(readSellerLocale(preferred_language));
      setProfile(current => current ? { ...current, ...fields, preferred_language: readSellerLocale(preferred_language) } : current);
      setNotice("Profile saved.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username : "";
  const initials = profile ? ([profile.first_name, profile.last_name].filter(Boolean).map(value => value[0]).join(" ") || profile.username.slice(0, 2)).toUpperCase() : "";

  return <SellerPage title="Profile" description="Update your contact details and language preference.">
    <div className="seller-page-narrow seller-profile-content">
      {loading ? <SellerLoadingState label="Loading…" rows={2} /> : error && !profile ? <SellerNotice>{error}</SellerNotice> : <>
        {profile && <section className="seller-profile-summary">
          <span className="seller-profile-avatar" aria-hidden="true">{initials}</span>
          <div className="seller-profile-identity"><strong data-seller-translate="skip">{name}</strong><span data-seller-translate="skip">{profile.email}</span></div>
          <div className="seller-profile-count"><span>Products in your catalogue</span><strong>{profile.product_count}</strong></div>
        </section>}
        <form className="seller-card seller-form-grid" onSubmit={submit}>
          {error && <SellerNotice>{error}</SellerNotice>}
          {notice && <SellerNotice kind="success">{notice}</SellerNotice>}
          <div className="seller-field-row">
            <label className="seller-field">First name<input value={form.first_name} onChange={event => setForm(value => ({ ...value, first_name: event.target.value }))} /></label>
            <label className="seller-field">Last name<input value={form.last_name} onChange={event => setForm(value => ({ ...value, last_name: event.target.value }))} /></label>
          </div>
          <label className="seller-field">Email<input type="email" required value={form.email} onChange={event => setForm(value => ({ ...value, email: event.target.value }))} /></label>
          <label className="seller-field">Phone<input type="tel" value={form.phone} onChange={event => setForm(value => ({ ...value, phone: event.target.value }))} /></label>
          <label className="seller-field">Preferred language<select value={form.preferred_language} onChange={event => setForm(value => ({ ...value, preferred_language: event.target.value }))}>{languages.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button className="seller-button primary" disabled={busy}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? "Saving…" : "Save profile"}</button>
        </form>
      </>}
    </div>
  </SellerPage>;
}
