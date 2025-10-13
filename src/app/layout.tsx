import "./globals.css";
import type { Metadata, Viewport } from "next";
import SWRegister from "./sw-register";

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
      </body>
    </html>
  );
}






