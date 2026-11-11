import type { Metadata } from "next";
import { Suspense } from "react";

import EbayBulkEndHistory from "@/components/ebay-bulk-end/EbayBulkEndHistory";
import { LocaleProvider } from "@/i18n";

export const metadata: Metadata = {
  title: "eBay history — BenimDepom",
  description: "Private history of eBay bulk listing operations.",
};

export default function Page() {
  return <LocaleProvider><Suspense fallback={<main aria-busy="true" />}><EbayBulkEndHistory /></Suspense></LocaleProvider>;
}
