import PairingButtons from "@/components/PairingButtons";
import AuthStatus from "@/components/AuthStatus";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header style={{ padding: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>Travel Memory</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <AuthStatus />
            <PairingButtons />
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}

