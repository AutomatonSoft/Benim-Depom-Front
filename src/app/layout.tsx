import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

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
    <html lang="en" className={`${montserrat.variable} ${montserrat.className}`}>
      <body>{children}</body>
    </html>
  );
}


