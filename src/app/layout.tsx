
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
  title: { default: "Travel Memory", template: "%s | Travel Memory" },
  description: "旅の思い出を地図に刻むPWA。家族・カップルで共有できる旅ログ。",
  manifest: "/manifest.webmanifest",
  themeColor: "#0ea5e9",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    // 180x180 を public/ に置いた場合はこちらを推奨
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Travel Memory"
  },
  other: { "mobile-web-app-capable": "yes" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        {/* SW登録（既存の実装を尊重） */}
        <SWRegister />
        {/* SW更新トースト & A2HSボタン */}
        <SWUpdater />
        <InstallCTA />
        <Script
          defer
          data-domain="travel-memory-1rem-hses9teyi-kisimoto-kazukis-projects.vercel.app"
          src="https://plausible.io/js/script.js"
      </body>
    </html>
  );
}



