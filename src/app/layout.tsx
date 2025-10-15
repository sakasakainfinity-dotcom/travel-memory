import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./sw-register";
import InstallCTA from '@/components/InstallCTA';
import SWUpdater from '@/components/SWUpdater';

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
    apple: [{ url: "/icons/icon-192.png" }]
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Travel Memory" },
  other: { "mobile-web-app-capable": "yes" }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <SWRegister />
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#000000" />
        {/* Plausible を使うなら↓（ドメインは差し替え） */}
        {/* <script defer data-domain="example.com" src="https://plausible.io/js/script.js"></script> */}
      </head>
      <body>
        {children}
        <SWUpdater />
        <InstallCTA />
      </body>
    </html>
  );
}




