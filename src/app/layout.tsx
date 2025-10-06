// src/app/layout.tsx
import "./globals.css";

export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };
export const metadata = { title: "Travel Memory", description: "旅の記憶を地図で残す" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}




