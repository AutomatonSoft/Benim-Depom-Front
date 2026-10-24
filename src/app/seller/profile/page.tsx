"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CircleUserRound, LoaderCircle } from "lucide-react";
import { SellerLoadingState, SellerNotice, SellerPage } from "@/components/SellerShell";
import { SellerApiError, sellerAvatarInitial, sellerRequest, type SellerProfile } from "@/lib/seller";
import { sellerApiErrorDetails } from "@/lib/seller-error-messages";
import { useSellerI18n } from "@/components/seller/SellerI18n";
import { isValidSellerPhone } from "@/lib/seller-phone";
import { isValidSellerName } from "@/lib/seller-name";

export default function SellerProfilePage() {
  const { t } = useSellerI18n();
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const changedFields = profile ? Object.fromEntries(
    (Object.keys(form) as Array<keyof typeof form>)
      .filter(key => form[key].trim() !== (profile[key] || "").trim())
      .map(key => [key, form[key].trim()]),
  ) : {};
  const hasChanges = Object.keys(changedFields).length > 0;

  useEffect(() => {
    sellerRequest<SellerProfile>("/api/v1/auth/me/").then(value => {
      setProfile(value);
      setForm({
        first_name: value.first_name || "", last_name: value.last_name || "", email: value.email || "",
        phone: value.phone || "",
      });
    }).catch(value => setError(value instanceof Error ? value.message : "Could not load profile."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!profile || busy || !hasChanges) return;
    setError("");
    setFieldErrors({});
    setNotice("");
    const nameErrors = Object.fromEntries((["first_name", "last_name"] as const)
      .filter(key => !isValidSellerName(form[key]))
      .map(key => [key, t("Names must contain 2–40 letters only, without spaces or symbols.")]));
    if (Object.keys(nameErrors).length) {
      setFieldErrors(nameErrors);
      document.getElementById(`seller-profile-${Object.keys(nameErrors)[0]}`)?.focus();
      return;
    }
    if (!isValidSellerPhone(form.phone)) {
      setFieldErrors({ phone: t("Enter a phone number with a country code and 8–15 digits, or leave the field empty.") });
      document.getElementById("seller-profile-phone")?.focus();
      return;
    }
    setBusy(true);
    try {
      const saved = await sellerRequest<SellerProfile>("/api/v1/auth/me/", { method: "PATCH", body: JSON.stringify(changedFields) });
      setProfile(saved);
      setForm(current => ({ ...current, ...Object.fromEntries(
        (Object.keys(form) as Array<keyof typeof form>)
          .filter(key => current[key] === form[key])
          .map(key => [key, saved[key] || ""]),
      ) }));
      setNotice("Profile saved.");
    } catch (value) {
      if (value instanceof SellerApiError) setFieldErrors(sellerApiErrorDetails(value.data, value.status).fields);
      setError(value instanceof Error ? value.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  const name = profile ? [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username : "";
  const initial = profile ? sellerAvatarInitial(profile) : "";

  return <SellerPage title="Profile" description="Update your contact details.">
    <div className="seller-page-narrow seller-profile-content">
      {loading ? <SellerLoadingState label="Loading…" rows={2} /> : error && !profile ? <SellerNotice>{error}</SellerNotice> : <>
        {profile && <section className="seller-profile-summary">
          <span className="seller-profile-avatar" aria-hidden="true">{initial || <CircleUserRound size={24} strokeWidth={1.8} />}</span>
          <div className="seller-profile-identity">
            <div className="seller-profile-name-line"><strong data-seller-translate="skip">{name}</strong>{(profile.first_name || profile.last_name) && <span className="seller-profile-username" aria-label={t("Username")} data-seller-translate="skip">@{profile.username}</span>}</div>
            <span data-seller-translate="skip">{profile.email}</span>
          </div>
          <div className="seller-profile-count"><span>Products in your catalogue</span><strong>{profile.product_count}</strong></div>
        </section>}
        <form className="seller-card seller-form-grid" onSubmit={submit} onChange={() => setFieldErrors({})}>
          {error && <SellerNotice>{error}</SellerNotice>}
          {notice && <SellerNotice kind="success">{notice}</SellerNotice>}
          <div className="seller-field-row">
            <label className="seller-field">First name<input id="seller-profile-first_name" autoComplete="given-name" aria-invalid={Boolean(fieldErrors.first_name)} value={form.first_name} onChange={event => { setNotice(""); setForm(value => ({ ...value, first_name: event.target.value })); }} />{fieldErrors.first_name && <small className="seller-field-error">{fieldErrors.first_name}</small>}</label>
            <label className="seller-field">Last name<input id="seller-profile-last_name" autoComplete="family-name" aria-invalid={Boolean(fieldErrors.last_name)} value={form.last_name} onChange={event => { setNotice(""); setForm(value => ({ ...value, last_name: event.target.value })); }} />{fieldErrors.last_name && <small className="seller-field-error">{fieldErrors.last_name}</small>}</label>
          </div>
          <label className="seller-field">Email<input type="email" required aria-invalid={Boolean(fieldErrors.email)} value={form.email} onChange={event => setForm(value => ({ ...value, email: event.target.value }))} />{fieldErrors.email && <small className="seller-field-error">{fieldErrors.email}</small>}</label>
          <label className="seller-field">Phone (optional)<input id="seller-profile-phone" type="tel" autoComplete="tel" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "seller-profile-phone-error" : undefined} value={form.phone} onChange={event => { setNotice(""); setForm(value => ({ ...value, phone: event.target.value })); }} />{fieldErrors.phone && <small id="seller-profile-phone-error" className="seller-field-error">{fieldErrors.phone}</small>}</label>
          <button className="seller-button primary" disabled={busy || !hasChanges}><LoaderCircle className={busy ? "seller-spinner" : "seller-spinner-slot"} size={18} strokeWidth={1.8} aria-hidden="true" />{busy ? "Saving…" : "Save profile"}</button>
        </form>
      </>}
    </div>
  </SellerPage>;
}
