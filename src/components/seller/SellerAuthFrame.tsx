"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChartNoAxesCombined, PackageCheck, ShieldCheck } from "lucide-react";
import { useSellerI18n } from "@/components/seller/SellerI18n";

export default function SellerAuthFrame({ children }: { children: ReactNode }) {
  const { t } = useSellerI18n();

  return <div className="seller-auth-frame">
    <aside className="seller-auth-story">
      <Link className="seller-auth-brand" href="/seller/login" aria-label={t("Benim Depom seller workspace")}>
        <span>BENIM</span><b>DEPOM</b><small>{t("SELLER WORKSPACE")}</small>
      </Link>
      <div className="seller-auth-story-copy">
        <span className="seller-auth-eyebrow">{t("Official seller workspace")}</span>
        <h2>{t("Manage your shop with clarity.")}</h2>
        <p>{t("Follow your products, review updates and sales from one place.")}</p>
      </div>
      <ul className="seller-auth-benefits">
        <li><PackageCheck size={19} aria-hidden="true" />{t("Track product review status")}</li>
        <li><ChartNoAxesCombined size={19} aria-hidden="true" />{t("See your actual sales results")}</li>
        <li><ShieldCheck size={19} aria-hidden="true" />{t("Seller-only account access")}</li>
      </ul>
    </aside>
    <div className="seller-auth-content">{children}</div>
  </div>;
}
