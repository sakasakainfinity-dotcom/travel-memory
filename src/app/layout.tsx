// src/app/layout.tsx
import "./globals.css";
import AuthGate from "@/components/AuthGate";

// ★ 追加：スマホではみ出し防止＆セーフエリア対応
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// （任意）タイトルとか付けたいなら
export const metadata = {
  title: "Travel Memory",
  description: "旅の記憶を地図で残す",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthGate>
          {/* ログイン後だけ表示されるヘッダー */}
          <header style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
            <div>Travel Memory</div>
          </header>
          {children}
        </AuthGate>
      </body>
    </html>
  );
}



