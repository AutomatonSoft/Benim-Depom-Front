import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Benim Depom | Türkiye'den Avrupa'ya Mobilya Satışı",
  description:
    "Benim Depom, Türkiye'deki mobilya üreticilerinin stoklarını mobil ürün girişi, AI görselleri, pazaryerleri ve lojistik desteği ile Avrupa pazarına sunmalarını kolaylaştırır.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}


