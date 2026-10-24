"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSellerI18n } from "@/components/seller/SellerI18n";

export default function SellerPasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const { t } = useSellerI18n();
  const [visible, setVisible] = useState(false);
  return <span className="seller-password-field">
    <input {...props} type={visible ? "text" : "password"} />
    <button type="button" className="seller-password-toggle" aria-label={t(visible ? "Hide password" : "Show password")} aria-pressed={visible} onClick={() => setVisible(current => !current)}>
      {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </span>;
}
