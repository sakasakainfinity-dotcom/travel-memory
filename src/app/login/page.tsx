"use client";
import PairingButtons from "@/components/PairingButtons";

export default function LoginPage() {
  return (
    <main className="login-wrap">
      {/* 背景の光 */}
      <div className="login-glow1" />
      <div className="login-glow2" />
　　  <div className="login-bg" /> 
      <div className="login-card">
        <div className="login-logo">
          <svg viewBox="0 0 24 24" width={28} height={28} aria-hidden>
            <path d="M12 2a10 10 0 1 0 10 10" fill="none" stroke="currentColor" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
        </div>

        <h1 className="login-title">サインイン</h1>
        <p className="login-sub">ログインすると、地図と投稿機能が使えるようになるよ。</p>

        <div style={{ height: 12 }} />

        <PairingButtons /> {/* ここは次でモバイル対応 */}

        <div style={{ height: 18 }} />
        <p className="login-note">
          ログインは <b>Google</b> または <b>メール</b> に対応。
          投稿データはあなた専用スペースに保存されるけぇ、安心して使いんさい。
        </p>
      </div>

      <footer className="login-footer">
        <a href="/" className="login-link">ホーム</a>
        <span style={{ opacity: .4 }}>・</span>
        <a href="#" className="login-link">プライバシー</a>
        <span style={{ opacity: .4 }}>・</span>
        <a href="#" className="login-link">利用規約</a>
      </footer>
    </main>
  );
}



