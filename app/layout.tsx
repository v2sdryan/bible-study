import type { Metadata } from "next";
import { Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import "./globals.css";

const notoSans = Noto_Sans_TC({
  variable: "--font-sans-tc",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const notoSerif = Noto_Serif_TC({
  variable: "--font-serif-tc",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

export const metadata: Metadata = {
  title: "和合本原文查經",
  description: "繁體中文聖經閱讀、原文對照、Gemini 查經解釋工具。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant" className={`${notoSans.variable} ${notoSerif.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
