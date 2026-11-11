import type { Metadata } from "next";

import EbayBulkEndPage from "@/components/ebay-bulk-end/EbayBulkEndPage";
import { LocaleProvider } from "@/i18n";

export const metadata: Metadata = {
  title: "eBay — BenimDepom",
  description: "Менеджерский инструмент проверки и завершения eBay объявлений по EAN.",
};

export default function Page() {
  return <LocaleProvider><EbayBulkEndPage /></LocaleProvider>;
}
