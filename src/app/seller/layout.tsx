import type { Metadata } from "next";
import type { ReactNode } from "react";
import SellerShell from "@/components/SellerShell";
import { SellerI18nProvider } from "@/components/seller/SellerI18n";
import "./seller.css";

export const metadata: Metadata = { title: "Benim Depom | Seller workspace", description: "Manage your Benim Depom products and sales." };
export default function SellerLayout({ children }: { children: ReactNode }) { return <SellerI18nProvider><SellerShell>{children}</SellerShell></SellerI18nProvider>; }
