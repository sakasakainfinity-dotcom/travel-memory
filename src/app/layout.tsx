import type { ReactNode } from "react";

export const metadata = { title: "Travel Memory" };


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

