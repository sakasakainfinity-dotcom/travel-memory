// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";

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
        {/* 任意：ホーム画面追加の案内（iOSは手動案内） */}
        <PWAInstallPrompt />
      </body>
    </html>
  );
}



