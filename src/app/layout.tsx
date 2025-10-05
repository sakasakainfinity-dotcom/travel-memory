import "./globals.css";
import AuthGate from "@/components/AuthGate";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthGate>
          {/* ログイン済みだけがここを見れる */}
          <header style={{ padding: 12, display: "flex", justifyContent: "space-between" }}>
            <div>Travel Memory</div>
            {/* ログアウトボタンは PairingButtons 内のを流用してもOKだけど
                既にどこかにあるならそれを置いてね */}
          </header>
          {children}
        </AuthGate>
      </body>
    </html>
  );
}


