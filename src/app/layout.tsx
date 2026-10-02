import type { Metadata } from "next";
import LegacyRefreshCleanup from "@/components/LegacyRefreshCleanup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Benim Depom | Türkiye'den Avrupa'ya Mobilya Satışı",
  description:
    "Benim Depom, Türkiye'deki mobilya üreticilerinin stoklarını mobil ürün girişi, AI görselleri, pazaryerleri ve lojistik desteği ile Avrupa pazarına sunmalarını kolaylaştırır.",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <LegacyRefreshCleanup />
        {children}
      </body>
    </html>
  );
}


