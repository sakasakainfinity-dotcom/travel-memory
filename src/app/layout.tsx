// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import SWRegister from "./sw-register";
import InstallCTA from "@/components/InstallCTA";
import SWUpdater from "@/components/SWUpdater";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0ea5e9",
};

export const metadata: Metadata = {
  title: { default: "PhotoMapper", template: "%s | PhotoMapper" },
  description: "大切な写真を、地図にしまう。",
  manifest: "/manifest.webmanifest",
  themeColor: "#0ea5e9",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Travel Memory" },
  other: { "mobile-web-app-capable": "yes" },

  // ✅ ここから追加
  metadataBase: new URL("https://photomappaer.com"),
  openGraph: {
    type: "website",
    url: "https://photomappaer.com",
    title: "PhotoMapper",
    description: "大切な写真を、地図にしまう。",
    siteName: "PhotoMapper",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "PhotoMapper",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PhotoMapper",
    description: "大切な写真を、地図にしまう。",
    images: ["/og.jpg"],
  },
  // ✅ ここまで追加
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        {/* SW登録（あるなら残す。無ければこの行は消してOK） */}
        <SWRegister />
        {/* SW更新トースト & A2HSボタン */}
        <SWUpdater />
        <InstallCTA />

        {/* ← ここが未クローズだった。`/>` で閉じる */}
        <Script
          defer
          data-domain="travel-memory-1rem-hses9teyi-kisimoto-kazukis-projects.vercel.app"
          src="https://plausible.io/js/script.js"
        />
      </body>
    </html>
  );
}



